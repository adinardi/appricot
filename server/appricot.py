from flask import Flask, session, redirect, url_for, request
import urllib2
import urllib
import simplejson
app = Flask(__name__)
app.debug = True
app.config['APPLICATION_ROOT'] = '/go'

@app.route('/user/is_auth')
def is_auth():
    return simplejson.dumps({"status": is_logged_in()})

def login():
    if is_logged_in() == False:
        return redirect("".join([
            "https://alpha.app.net/oauth/authenticate?",
            "client_id=","PkMGurQpTzGLmcyzK65sj4JXpkzVwUtE",
            "&response_type=code",
            "&redirect_uri=","http://appricot.thetr.net/callback",
            "&scope=stream write_post",
            ]))


@app.route('/user/stream')
def stream():

    req = urllib2.urlopen("https://alpha-api.app.net/stream/0/posts/stream?access_token=" + session['access_token'])
    # simplejson.loads(req.read())
    return req.read()

@app.route('/callback')
def callback():
    if request.args.has_key('code'):
        code = request.args.get('code')
        req = urllib2.urlopen("https://alpha.app.net/oauth/access_token", urllib.urlencode({
            'client_id': 'PkMGurQpTzGLmcyzK65sj4JXpkzVwUtE',
            'client_secret': '<POOP>',
            'grant_type': 'authorization_code',
            'redirect_uri': 'http://appricot.thetr.net/go/callback',
            'code': code,
            }))
        token = simplejson.loads(req.read())
        session['access_token'] = token['access_token']
        return redirect("/")
    else:
        return 'NO CODE'

def is_logged_in():
    if 'access_token' in session:
        return True

    return False

if __name__ == '__main__':
    app.run()

app.secret_key = 'A0Zr98j/3yX R~POOOOOP8LKHDF*(7opuF*(&'