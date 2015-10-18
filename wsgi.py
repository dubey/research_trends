#! /usr/bin/env python
# 
# ===============================================================
#    Description:  wsgi for research-trends 
# 
#        Created:  2015-10-03 13:25:42
# 
#         Author:  Ayush Dubey, dubey@cs.cornell.edu
# 
# Copyright (C) 2015, Cornell University, see the LICENSE file
#                     for licensing agreement
# ===============================================================
# 

import sys
paths = ['/var/www/', '/var/www/research-trends/', '/home/dubey/installs/lib/python2.7/site-packages/python_bitcoinlib-0.3.1_SNAPSHOT-py2.7.egg']
for path in paths:
    if path not in sys.path:
        sys.path.insert(0, path)

from server import app as application
