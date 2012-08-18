appricot = {};

appricot.run = function() {
    var app = new appricot.App();
    app.render(document.getElementById('root'));
};

appricot.login = function() {
    window.location.href = [
        "https://alpha.app.net/oauth/authenticate?",
        "client_id=","PkMGurQpTzGLmcyzK65sj4JXpkzVwUtE",
        "&response_type=token",
        "&redirect_uri=","http://appricot.thetr.net/",
        "&scope=stream write_post",
    ].join('');
};

appricot.App = Class.$extend({
    rootNode: null,
    authenticated: false,

    __init__: function() {
        if (window.location.hash.match('#access_token') || window.localStorage['ACCESS_TOKEN']) {
            if (window.location.hash.match('#access_token')) {
                appricot.ACCESS_TOKEN = window.location.hash.split("=")[1];
                window.localStorage['ACCESS_TOKEN'] = appricot.ACCESS_TOKEN;
            } else {
                appricot.ACCESS_TOKEN = window.localStorage['ACCESS_TOKEN'];
            }
            window.location.href = '#';
            this.authenticated = true;
        } else {
            appricot.login();
        }
    },

    render: function(node) {
        this.rootNode = node;

        if (this.authenticated) {
            this.renderUI();
        }
    },


    renderUI: function() {
        var userStream = new appricot.UserStream();

        var refresh = document.createElement('i');
        bonzo(refresh).addClass('icon-refresh');
        bean.add(refresh, 'click', _.bind(this.handleRefreshButton, this, userStream));
        bonzo(this.rootNode).append(refresh);

        bonzo(this.rootNode).append(userStream.render());
        userStream.load();
    },

    handleRefreshButton: function(stream) {
        stream.loadMoreNewer();
    }
});

appricot.Stream = Class.$extend({
    cache: null,
    isFetching: false,

    __init__: function(endpoint) {
        this.endpoint = endpoint;
        this.cache = [];
    },

    load: function() {
        this.cache = [];
        this.loadData();
    },

    loadData: function(params) {
        this.isFetching = true;

        params = params || {};

        reqwest({
            url: this.endpoint,
            type: 'json',
            data: _.extend({
                'access_token': appricot.ACCESS_TOKEN
            }, params),
            success: _.bind(this.handleLoad, this),
            error: _.bind(function(err) {
                if (err.status == 401) {
                    appricot.login();
                }
            }, this)
        });
    },

    render: function() {
        if (!this.node) {
            this.node = document.createElement('div');
            bonzo(this.node).addClass('span6 stream_container');
            bean.add(this.node, 'scroll', _.bind(this.handleScroll, this));
        }

        return this.node;
    },

    handleScroll: function(e) {
        var wrappedNode = bonzo(this.node);
        if (wrappedNode.scrollTop() >= this.node.scrollHeight - wrappedNode.offset().height - 10) {
            this.loadMorePrevious();
        }
    },

    handleLoad: function(data) {
        this.isFetching = false;
    },

    loadMorePrevious: function() {
        if (this.isFetching) {
            return;
        }

        this.loadData({before_id: _.last(this.cache).id});
    },

    loadMoreNewer: function(before_id) {
        if (this.isFetching) {
            return;
        }

        this.loadData({
            since_id: parseInt(_.first(this.cache).id) - 1,
            before_id: before_id || null
        });
    }
});

appricot.UserStream = appricot.Stream.$extend({
    __init__: function() {
        this.$super('https://alpha-api.app.net/stream/0/posts/stream');
    },

    handleLoad: function(data) {
        var fetchMoreBefore = null;

        if (this.cache.length > 0) {
            if (parseInt(_.last(data).id) > parseInt(_.first(this.cache).id)) {
                fetchMoreBefore = _.last(data).id
            }
        }

        this.cache = _.union(this.cache, data);
        this.cache = _.sortBy(this.cache, function(item) { return parseInt(item.id); }); // this will break for large numbers...
        this.cache = _.uniq(this.cache, true, function(item) { return item.id; });
        this.cache.reverse();
        bonzo(this.node).html(
            Mustache.render("{{#posts}}<div class='post row-fluid'>{{id}}<br><div class='span1'><img class='avatar' src='{{user.avatar_image.url}}' /></div><div class='span10'><b>{{user.username}}</b><br />{{&html}}</div></div>{{/posts}}", {posts: this.cache})
        );

        this.isFetching = false;

        if (fetchMoreBefore) {
            this.loadMoreNewer(fetchMoreBefore);
        }
    }
});
