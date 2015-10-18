from datetime import date
from datetime import timedelta
from time import mktime
from bisect import bisect_right
from math import floor
import re

MIN_DATE = "1970-01-01"
MAX_DATE = "2015-01-01"
BIN_NUM = 30

def str_to_date(string):
    mm = dd = 1
    match = re.match("(\d{4})-(\d{1,2})-(\d{1,2})", string)
    if match:
        dd = int(match.group(3))
    else:
        match = re.match("(\d{4})-(\d{1,2})", string)
    if match:
        mm = int(match.group(2))
    else:
        match = re.match("(\d{4})", string)
    if match:
        yy = int(match.group(1))
    else:
        raise Exception(string)
    return date(yy,mm,dd)

def date_to_int(d):
    return int(mktime(d.timetuple())) * 1000

def date_histogram(papers, start, end, bin_num=30):
    start_date = date_to_int(str_to_date(start))
    end_date = date_to_int(str_to_date(end))
    bin_gap = int(floor((end_date - start_date) / bin_num))
    bins = [start_date + i * bin_gap for i in xrange(0, bin_num)]
    res = [[] for i in xrange(bin_num)]
    for doc in papers:
        idx = bisect_right(bins, date_to_int(str_to_date(doc.date))) - 1
        res[idx].append(doc)
    return res
