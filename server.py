from flask import Flask, render_template
from ConfigParser import SafeConfigParser
import weaver.client as wclient
import hyperdex.client
from importlib import import_module

config_parser = SafeConfigParser({'weaver': 'True',
                                    'ajax': 'True',
                                    'ajax_method': 'POST',
                                    'static': 'True',
                                    'mod_file': 'True'})
config_parser.read('/var/www/research-trends/server.cfg')

HTTP_HOST = config_parser.get('general', 'host') or '0.0.0.0'
HTTP_PORT = config_parser.getint('general', 'port') or '80'
HTTP_DEBUG = config_parser.getboolean('general', 'debug') or False
BRAND = config_parser.get('general', 'name')

modules = [ i.strip() for i in \
            config_parser.get('general', 'modules').split(',')] or []
DEFAULT_MOD = config_parser.get('general', 'default')

class PageModule(object):
    _ajax = False
    def __init__(self, name, title, path, weaver, cp):
        self.name = name
        self.path = path
        self.title = title
        self.weaver = weaver
        self.config_parser = cp
    def gen_app(self):
        if path:
            view = lambda: render_template('{0}.html'.format(self.name),
                        site=site, current_page=self.name)
        else:
            view = None
        return view, self._ajax

pages = []

class Site:
    def __init__(self, pages, brand):
        self.pages = pages
        self.brand = brand

site = Site(pages, BRAND)

app = Flask(__name__)

def _get_with_defaults(cp, section, option, default=None):
    if cp.has_option(section, option):
        return cp.get(section, option)
    else:
        return default
SafeConfigParser.get_with_defaults = _get_with_defaults

for mod in modules:
    weaver = config_parser.getboolean(mod, 'weaver')
    static = config_parser.getboolean(mod, 'static')
    ajax = config_parser.getboolean(mod, 'ajax')

    if weaver:
        host = config_parser.get(mod, 'host')
        port = config_parser.getint(mod, 'port')
        conf = config_parser.get(mod, 'conf')
        wc = wclient.Client(host, port, conf)
    else:
        wc = None

    if static:
        title = config_parser.get_with_defaults(mod, 'title', None)
        path = config_parser.get(mod, 'path')
    else:
        title = None
        path = None

    if ajax:
        ajax_path = config_parser.get_with_defaults(mod, 'ajax_path', config_parser.get(mod, 'ajax_path'))
        print 'mod=%s ajax_path=%s path=%s' % (mod, ajax_path, path)
    else:
        ajax_path = None

    if config_parser.getboolean(mod, 'mod_file'):
        get_page_module = import_module(mod).get_page_module
        Module = get_page_module(PageModule)
    else:
        Module = PageModule
    m = Module(mod, title, path, wc, config_parser)
    view, ajax_app = m.gen_app()
    if ajax_app:
        method = config_parser.get(mod, 'ajax_method')
        app.add_url_rule(ajax_path, '{0}-ajax'.format(mod),
                        ajax_app, methods=[method])
    if view:
        app.add_url_rule(path, mod, view)
        if DEFAULT_MOD == mod:
            app.add_url_rule('/', mod, view)
        if title is not None:
            pages.append(m)

if __name__ == "__main__":
    app.run(host=HTTP_HOST, port=HTTP_PORT, threaded=True, debug=HTTP_DEBUG)
