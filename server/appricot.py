from flask import Flask, session, redirect, url_for, request
import urllib2
import urllib
import simplejson
import redis
app = Flask(__name__)
app.debug = True
app.config['APPLICATION_ROOT'] = '/go'

@app.route('/set_position', methods=['GET', 'POST'])
def set_position():
    user = check_auth(request.form.get('access_token', request.args.get('access_token')))
    if not user:
        return simplejson.dumps({"error": "access_token invalid", "code": 401})

    stream_id = request.form.get('stream_id', request.args.get('stream_id'))
    key = "".join([
        "appricot_position_",
        user["user"]["id"],
        "_",
        stream_id
        ])
    r = redis.StrictRedis()
    r.set(key, request.form.get('position', request.args.get('position')))

    return simplejson.dumps({'status': 'success'})

@app.route('/get_position', methods=['GET', 'POST'])
def get_position():
    user = check_auth(request.form.get('access_token', request.args.get('access_token')))
    if not user:
        return simplejson.dumps({"error": "access_token invalid", "code": 401})

    stream_id = request.form.get('stream_id', request.args.get('stream_id'))
    key = "".join([
        "appricot_position_",
        user["user"]["id"],
        "_",
        stream_id
        ])
    r = redis.StrictRedis()
    pos = r.get(key)

    return simplejson.dumps({'status': 'success', 'position': pos})

def check_auth(token):
    req = urllib2.urlopen("https://alpha-api.app.net/stream/0/token?access_token=" + token)
    data = simplejson.loads(req.read())
    if data.has_key('code') and data["code"] == 401:
        return False

    return data

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