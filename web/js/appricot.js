appricot = {};

appricot.run = function() {
    var app = new appricot.App();
};

appricot.App = Class.$extend({
    __init__: function() {
        if (window.location.hash.match('#access_token') || window.localStorage['ACCESS_TOKEN']) {
            if (window.location.hash.match('#access_token')) {
                appricot.ACCESS_TOKEN = window.location.hash.split("=")[1];
                window.localStorage['ACCESS_TOKEN'] = appricot.ACCESS_TOKEN;
            } else {
                appricot.ACCESS_TOKEN = window.localStorage['ACCESS_TOKEN'];
            }
            window.location.href = '#';
            this.renderUI();
        } else {
            this.login();
        }
    },

    login: function() {
        window.location.href = [
            "https://alpha.app.net/oauth/authenticate?",
            "client_id=","PkMGurQpTzGLmcyzK65sj4JXpkzVwUtE",
            "&response_type=token",
            "&redirect_uri=","http://appricot.thetr.net/",
            "&scope=stream write_post",
        ].join('');
    },

    renderUI: function() {
        var userStream = new appricot.UserStream();
        document.body.appendChild(userStream.node);
        userStream.refresh();
    }
});

appricot.Stream = Class.$extend({
    __init__: function(endpoint) {
        this.endpoint = endpoint;
        this.node = document.createElement('div');
    },

    refresh: function() {
        reqwest({
            url: this.endpoint,
            type: 'json',
            data: {'access_token': appricot.ACCESS_TOKEN},
            success: _.bind(this.handleRefresh, this),
            error: _.bind(function(err) { if (err.status == 401) { this.login(); } }, this)
        });
    },

    handleRefresh: function(data) {
        // something?
    }
});

appricot.UserStream = appricot.Stream.$extend({
    __init__: function() {
        this.$super('https://alpha-api.app.net/stream/0/posts/stream');
    },

    handleRefresh: function(data) {
        this.node.innerHTML = Mustache.render("{{#posts}}<div><b>{{user.username}}</b><br />{{&html}}</div>{{/posts}}", {posts: data});
    }
});
