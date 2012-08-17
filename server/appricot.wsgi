activate_this = '/var/www/appricot.thetr.net/ENV/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

import sys
sys.path.insert(0, '/var/www/appricot.thetr.net/server/')

from appricot import app as application
