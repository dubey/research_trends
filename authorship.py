import json
from flask import request
import weaver.client as wclient
from unidecode import unidecode

def merge_subgraph(graph1, graph2):
    merged = {node: {edge.handle : edge for edge in graph1[node]} for node in graph1}
    for node in graph2:
        if not node in merged:
            merged[node] = {}
        medges = merged[node]
        for edge in graph2[node]:
            if not edge.handle in medges:
                medges[edge.handle] = edge
    return {node: [e for h, e in merged[node].iteritems()] for node in merged}

def _get_paths(self, author1, author2, steps, bf):
    res1 = self.weaver.discover_paths(author1, author2,
                                      path_len=steps,
                                      branching_factor=bf,
                                      random_branching=False,
                                      branching_property='numdocs')[0]
    res2 = self.weaver.discover_paths(author1, author2,
                                      path_len=steps,
                                      branching_factor=bf,
                                      random_branching=False,
                                      branching_property='numdocs')[0]
    for k in res2:
        if k not in res1:
            res1[k] = []
        edge_handles = set([e.handle for e in res1[k]])
        for e in res2[k]:
            if e.handle not in edge_handles:
                res1[k].append(e)
                edge_handles.add(e.handle)
    return res1

def _authorship_ajax(self):
    author_text = request.form['authors'].encode('utf-8')
    author_list = author_text.split(',')
    author_from = author_list[0].strip().strip('\"\'')
    author_to   = author_list[1].strip().strip('\"\'') if len(author_list) > 1 else None
    try:
        author_step = int(request.form['step'])
    except ValueError:
        author_step = self._max_step
    author_step = min(self._max_step, author_step)

    try:
        res = {}
        single_author = None

        # if user has entered only single author, return that node's edges
        if author_from and not author_to:
            single_author = author_from

        if single_author is not None:
            print 'single auth query=%s' % single_author
            n = self.weaver.get_node(single_author)
            edges = []
            for e in n.out_edges.values():
                edges.append(e)
                res[e.end_node] = []
            res[single_author] = edges
        else:
            if author_from and author_to:
                print 'auth1=%s auth2=%s' % (author_from, author_to)
                # user has entered both authors, find paths
                if author_step > 1:
                    # first try with small paths
                    res = _get_paths(self, author_from, author_to, author_step-1, 20)
                if not res:
                    res = _get_paths(self, author_from, author_to, author_step, 20)

    except wclient.WeaverError:
        res = {}

    lst  = {author: [{'to': e.end_node} for e in res[author]] for author in res}
    name = {author: unidecode(unicode(author, 'utf-8')) for author in lst}
    resp = {'from' : author_from,
            'to'   : author_to,
            'graph': lst,
            'names': name}
    return json.dumps(resp)

def get_page_module(pm_cls):
    class Module(pm_cls):
        _ajax = _authorship_ajax
        def __init__(self, *args):
            super(Module, self).__init__(*args)
            self._max_step = self.config_parser.getint('authorship', 'max_step') or 4
    return Module
