appricot = {};

appricot.run = function() {
    if (window.location.protocol != 'https:') {
        window.location.href = 'https://appricot.me';
        return;
    }
    var app = new appricot.App();
    app.render(document.getElementById('root'));
};

appricot.login = function() {
    window.location.href = [
        "https://alpha.app.net/oauth/authenticate?",
        "client_id=","PkMGurQpTzGLmcyzK65sj4JXpkzVwUtE",
        "&response_type=token",
        "&redirect_uri=","https://appricot.me/",
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
        var globalStream = new appricot.GlobalStream();
        var mentionStream = new appricot.MentionStream();

        var toolbar = document.createElement('div');
        bonzo(toolbar).addClass('toolbar');

        var allStreams = document.createElement('div');
        bonzo(allStreams).addClass('all_streams');

        var refresh = document.createElement('button');
        bonzo(refresh)
            .addClass('btn')
            .html("<i class='icon-refresh'></i>");
        bean.add(refresh, 'click', _.bind(this.handleRefreshButton, this, userStream));
        bean.add(refresh, 'click', _.bind(this.handleRefreshButton, this, globalStream));
        bean.add(refresh, 'click', _.bind(this.handleRefreshButton, this, mentionStream));
        bonzo(toolbar).append(refresh);

        var postBtn = document.createElement('button');
        bonzo(postBtn)
            .addClass('btn')
            .html("<i class='icon-pencil'></i>");
        bean.add(postBtn, 'click', _.bind(this.handlePostButton, this));
        bonzo(toolbar).append(postBtn);

        bonzo(allStreams).append(userStream.render());
        bonzo(allStreams).append(mentionStream.render());
        bonzo(allStreams).append(globalStream.render());
        bonzo(userStream.render()).addClass('stream');
        bonzo(mentionStream.render()).addClass('stream');
        bonzo(globalStream.render()).addClass('stream');

        bonzo(this.rootNode)
            .append(toolbar)
            .append(allStreams);

        userStream.load();
        mentionStream.load();
        globalStream.load();
    },

    handlePostButton: function(e) {
        var post = new appricot.PostBox();
        bonzo(document.body).append(post.render());
    },

    handleRefreshButton: function(stream, e) {
        _gaq.push(['_trackEvent', 'Streams', 'Refresh Button Click', '']);
        stream.loadMoreNewer();
    }
});

appricot.PostBox = Class.$extend({
    node: null,

    __init__: function() {

    },

    render: function() {
        if (!this.node) {
            this.node = document.createElement('div');

            this.textarea = document.createElement('textarea');

            var post = document.createElement('button');
            bonzo(post)
                .addClass('btn btn-success')
                .text('Post');
            bean.add(post, 'click', _.bind(this.handlePostButton, this));

            var cancel = document.createElement('button');
            bonzo(cancel)
                .addClass('btn')
                .text('Cancel');
            bean.add(cancel, 'click', _.bind(this.handleCancelButton, this));

            bonzo(this.node)
                .addClass('postbox')
                .append(this.textarea)
                .append(post)
                .append(cancel);
        }

        return this.node;
    },

    handlePostButton: function(e) {
        reqwest({
            url: 'https://alpha-api.app.net/stream/0/posts',
            type: 'json',
            method: 'post',
            data: {
                'access_token': appricot.ACCESS_TOKEN,
                'text': this.textarea.value
            },
            success: _.bind(this.handlePostSuccess, this),
            error: _.bind(this.handlePostError, this)
        });
    },

    handleCancelButton: function(e) {
        bonzo(this.node).remove();
    },

    handlePostSuccess: function(data) {
        bonzo(this.node).remove();
    },

    handlePostError: function() {

    }
});

appricot.Stream = Class.$extend({
    cache: null,
    isFetching: false,
    topOfFirstLoad: 0,
    postNode: null,
    firstLoad: true,
    currentTopPostId: 0,

    __init__: function(endpoint) {
        this.endpoint = endpoint;
        this.cache = [];
    },

    load: function() {
        this.cache = [];
        if (this.firstLoad) {
            this.firstLoad = false;
            this.loadPositionFromServer();
            return;
        }
        // var lastPos = window.localStorage['stream_pos_' + this.type];
        if (this.currentTopPostId) {
            this.loadTopStreamAfterNextFetch = true;
            this.loadData({
                before_id: parseInt(this.currentTopPostId, 10) + 1
            });
        } else {
            this.loadData();
        }
    },

    loadPositionFromServer: function() {
        reqwest({
            url: 'https://appricot.me/go/get_position',
            type: 'json',
            data: {
                'access_token': appricot.ACCESS_TOKEN,
                'stream_id': this.type
            },
            success: _.bind(this.handlePositionLoad, this)
        });
    },

    savePositionToServer: _.debounce(function(pos) {
        reqwest({
            url: 'https://appricot.me/go/set_position',
            type: 'json',
            data: {
                'access_token': appricot.ACCESS_TOKEN,
                'stream_id': this.type,
                'position': pos
            }
        });
    }, 10000),

    handlePositionLoad: function(data) {
        if (data["code"] == 401) {
            appricot.login();
            return;
        }

        this.currentTopPostId = data['position'];
        if (this.currentTopPostId) {
            this.currentTopPostId = parseInt(this.currentTopPostId, 10);
        }

        this.load();
    },

    loadData: function(params) {
        this.isFetching = true;

        params = params || {};

        reqwest({
            url: this.endpoint,
            type: 'json',
            data: _.extend({
                'access_token': appricot.ACCESS_TOKEN,
                'count': 100
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
            bonzo(this.node).addClass('stream_container');

            this.statusBar = document.createElement('div');
            bonzo(this.statusBar).addClass('statusbar');
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

            if (this.currentTopPostId != topPost.id) {
                // window.localStorage['stream_pos_' + this.type] = topPost.id;
                this.savePositionToServer(topPost.id);
                this.currentTopPostId = topPost.id;
            }
            this.updateStatus(count);
        }


        var wrappedNode = bonzo(this.postNode);
        if (wrappedNode.scrollTop() >= this.postNode.scrollHeight - wrappedNode.offset().height - 10) {
            this.loadMorePrevious();
        }
    },

    handleLoad: function(data) {
        var fetchMoreBefore = null;
        var oldTopPost = null;
        var topOfCache = null;

        var isFreshCache = (this.cache.length == 0);

        if (data.length == 0) {
            console.log("NO DATA!? OMG");
            return;
        }

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
            if (_.last(data).id > _.first(this.cache).id) {
                this.topOfFirstLoad = _.first(this.cache).id;
            }

            // the post which is on top at present (before we add in the new dataset).
            oldTopPost = _.first(this.cache);
        }

        this.cache = _.union(this.cache, data);

        var idMap = _.groupBy(this.cache, 'id');
        this.cache = _.map(idMap, function(value, key, list) {
            if (value.length == 1) {
                return value[0];
            } else {
                var rendered = _.find(value, function(post) {
                    if (bonzo(post.render()).parent().length > 0) {
                        return true;
                    }
                }, this);

                if (rendered) {
                    return rendered;
                } else {
                    return value[0];
                }
            }
        }, this);

        this.cache = _.sortBy(this.cache, function(item) { return item.id; }); // this will break for large numbers...
        // this.cache = _.uniq(this.cache, true, function(item) { return item.id; });
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
    }
});

appricot.GlobalStream = appricot.Stream.$extend({
    type: 'globalstream',

    __init__: function() {
        this.$super('https://alpha-api.app.net/stream/0/posts/stream/global');
    },

    load: function() {
        this.cache = [];

        this.loadData();
    }
});

appricot.MentionStream = appricot.Stream.$extend({
    type: 'mentionstream',

    __init__: function() {
        this.$super('https://alpha-api.app.net/stream/0/users/me/mentions');
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

            var content = this.post.text || '';
            var mentions = this.post.entities.mentions;
            var hashtags = this.post.entities.hashtags;
            var links = this.post.entities.links;

            var entities = [];

            _.each(mentions, function(elem, index, list) {
                entities.push({
                    pos: elem.pos,
                    len: elem.len,
                    html: Mustache.render("<a href='https://alpha.app.net/{{username}}'>@{{username}}</a>", {
                        username: elem.name
                    })
                });
            }, this);

            _.each(hashtags, function(elem, index, list) {
                entities.push({
                    pos: elem.pos,
                    len: elem.len,
                    html: Mustache.render("<a href='https://alpha.app.net/hashtags/{{tag}}'>#{{tag}}</a>", {
                        tag: elem.name
                    })
                });
            }, this);

            _.each(links, function(elem, index, list) {
                entities.push({
                    pos: elem.pos,
                    len: elem.len,
                    html: Mustache.render("<a href='{{url}}'>{{text}}</a>", {
                        url: elem.url,
                        text: elem.text
                    })
                });
            }, this);

            // Sort entities
            entities = _.sortBy(entities, 'pos');
            entities.reverse();

            // Apply them.
            _.each(entities, function(elem, index, list) {
                content = content.substring(0, elem.pos) + elem.html + content.substring(elem.pos + elem.len);
            }, this);

            var date = new Date(this.post.created_at);
            bonzo(this.node)
                .addClass('post row-fluid')
                .html(Mustache.render("<div class='span1'><img class='avatar' src='{{post.user.avatar_image.url}}' /></div><div class='span11'><div class='row-fluid'><div class='span5'><b><a href='https://alpha.app.net/{{post.user.username}}' target='_blank'>{{post.user.username}}</a></b></div><div class='span6'><a href='https://alpha.app.net/{{post.user.username}}/post/{{post.id}}' target='_blank'>{{date}}</a></div></div><div class='row-fluid post_content'>{{&content}}</div></div>", {
                    post: this.post,
                    content: content.replace("\n", "<br>"),
                    date: date.toDateString() + " " + date.toLocaleTimeString()
                }));
        }

        return this.node;
    }
});
