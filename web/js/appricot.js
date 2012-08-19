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

        var refresh = document.createElement('button');
        bonzo(refresh)
            .addClass('btn')
            .html("<i class='icon-refresh'></i>");
        bean.add(refresh, 'click', _.bind(this.handleRefreshButton, this, userStream));

        var topRow = document.createElement('div');
        bonzo(topRow)
            .addClass('row-fluid')
            .append(refresh);

        bonzo(this.rootNode).append(topRow);

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
    topOfFirstLoad: 0,
    postNode: null,

    __init__: function(endpoint) {
        this.endpoint = endpoint;
        this.cache = [];
    },

    load: function() {
        this.cache = [];
        var lastPos = window.localStorage['stream_pos_' + this.type];
        this.currentTopPostId = lastPos;
        if (lastPos) {
            this.loadTopStreamAfterNextFetch = true;
            this.loadData({
                before_id: parseInt(lastPos, 10) + 1
            });
        } else {
            this.loadData();
        }
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

            this.statusBar = document.createElement('div');
            bonzo(this.statusBar).addClass('row-fluid statusbar');
            bonzo(this.node).append(this.statusBar);

            this.postNode = document.createElement('div');
            bonzo(this.postNode).addClass('stream_post_container');
            bonzo(this.node).append(this.postNode);
            bean.add(this.postNode, 'scroll', _.bind(this.handleScroll, this));
        }

        return this.node;
    },

    updateStatus: function(count) {
        bonzo(this.statusBar).html(
            Mustache.render("{{count}} new posts", {
                count: count
            })
        );
    },

    handleScroll: function(e) {
        if (this.lockScroll) {
            return;
        }

        var count = 0;
        if (this.cache.length > 0) {
            var scrollTop = bonzo(this.postNode).scrollTop();
            var topPost = _.find(this.cache, function(item) {
                if(item.render().offsetTop >= scrollTop) {
                    return true;
                }
                count++;
            }, this);
            window.localStorage['stream_pos_' + this.type] = topPost.id;
            this.currentTopPostId = topPost.id;
            this.updateStatus(count);
        }


        var wrappedNode = bonzo(this.postNode);
        if (wrappedNode.scrollTop() >= this.postNode.scrollHeight - wrappedNode.offset().height - 10) {
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
    type: 'userstream',

    __init__: function() {
        this.$super('https://alpha-api.app.net/stream/0/posts/stream');
    },

    handleLoad: function(data) {
        var fetchMoreBefore = null;
        var oldTopPost = null;
        var isNewerData = false;
        var topOfCache = null;

        var isFreshCache = (this.cache.length == 0);

        // Create post wrapper objects for all the new items.
        data = _.map(data, function(item) {
            return new appricot.Post(item);
        });

        if (isFreshCache) {
            this.topOfFirstLoad = _.first(data).id;
        } else {
            topOfCache = _.first(this.cache);
            // new data is "newer" than the existing cache data.
            console.log(_.last(data).id, this.topOfFirstLoad);
            if (this.topOfFirstLoad && _.last(data).id <= this.topOfFirstLoad) {
                this.topOfFirstLoad = 0;
            }
            if (_.last(data).id >= _.first(this.cache).id) {
                isNewerData = true;

                // Doesn't overlap -- need to fetch more.
                if (_.last(data).id > _.first(this.cache).id) {
                    fetchMoreBefore = _.last(data).id + 1;
                } else {
                    this.topOfFirstLoad = 0;
                }
            }

            // the post which is on top at present (before we add in the new dataset).
            oldTopPost = _.first(this.cache);
        }

        this.cache = _.union(this.cache, data);
        this.cache = _.sortBy(this.cache, function(item) { return item.id; }); // this will break for large numbers...
        this.cache = _.uniq(this.cache, true, function(item) { return item.id; });
        this.cache.reverse();

        var oldScrollHeight = this.postNode.scrollHeight;
        this.lockScroll = true;
        var shouldAdjustPosition = false;

        _.each(this.cache, function(element, index, list) {
            if (bonzo(element.render()).parent().length == 0) {
                if (index == 0) {
                    bonzo(this.postNode).prepend(element.render());
                } else {
                    bonzo(element.render()).insertAfter(list[index - 1].render());
                }
            }
        }, this);

        // Was this element above the current viewed top post?
        if (this.currentTopPostId && _.first(data).id > this.currentTopPostId) {
            shouldAdjustPosition = true;
        }

        if (!isFreshCache && shouldAdjustPosition) {
            var diffScrollHeight = this.postNode.scrollHeight - oldScrollHeight;
            bonzo(this.postNode).scrollTop(bonzo(this.postNode).scrollTop() + diffScrollHeight);
        }

        this.lockScroll = false;

        this.isFetching = false;

        if (this.topOfFirstLoad) {
            this.loadData({
                since_id: this.topOfFirstLoad - 1,
                before_id: (_.last(data).id > this.topOfFirstLoad ? _.last(data).id : null)
            });
            return;
        }

        if (fetchMoreBefore) {
            this.loadMoreNewer(fetchMoreBefore);
        }
    }
});

appricot.Post = Class.$extend({
    post: null,
    node: null,
    id: 0,

    __init__: function(post) {
        this.post = post;
        this.id = parseInt(this.post.id, 10);
    },

    render: function() {
        if (!this.node) {
            this.node = document.createElement('div');
            bonzo(this.node)
                .addClass('post row-fluid')
                .html(Mustache.render("<div class='span1'><img class='avatar' src='{{post.user.avatar_image.url}}' /></div><div class='span10'><div class='row-fluid'><div class='span5'><b><a href='https://alpha.app.net/{{post.user.username}}' target='_blank'>{{post.user.username}}</a></b></div><div class='span5'><a href='https://alpha.app.net/{{post.user.username}}/post/{{post.id}}' target='_blank'>{{post.created_at}}</a></div></div><div class='row-fluid post_content'>{{&post.html}}</div></div>", {
                    post: this.post
                }));
        }

        return this.node;
    }
});
