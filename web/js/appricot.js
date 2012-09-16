appricot = {};

appricot.run = function() {
    if (!Modernizr.flexbox && !Modernizr.flexboxlegacy) {
        return;
    }
    if (window.navigator.userAgent.match(/Firefox/)) {
        bonzo(document.body.parentNode).addClass('moz');
    }

    var app = new appricot.App();
    app.render(document.getElementById('root'));
};

appricot.login = function() {
    window.location.href = [
        "https://alpha.app.net/oauth/authenticate?",
        "client_id=","PkMGurQpTzGLmcyzK65sj4JXpkzVwUtE",
        "&response_type=token",
        "&redirect_uri=", window.location.origin,
        "&scope=stream write_post",
    ].join('');
};

appricot.App = Class.$extend({
    rootNode: null,
    authenticated: false,
    /**
     * The side toolbar with buttons.
     */
    toolbarElem: null,
    allStreamsElem: null,

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
            mixpanel.track('Authenticated User');
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
        bean.on(userStream, 'minimize', _.bind(this.handleStreamMinimize, this), userStream);
        var globalStream = new appricot.GlobalStream();
        bean.on(globalStream, 'minimize', _.bind(this.handleStreamMinimize, this), globalStream);
        var mentionStream = new appricot.MentionStream();
        bean.on(mentionStream, 'minimize', _.bind(this.handleStreamMinimize, this), mentionStream);

        var toolbar = document.createElement('div');
        bonzo(toolbar).addClass('toolbar');
        this.toolbarElem = toolbar;

        var allStreams = document.createElement('div');
        bonzo(allStreams).addClass('all_streams');
        this.allStreamsElem = allStreams;

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
        post.focus();

        mixpanel.track('Click Post Button');
    },

    handleRefreshButton: function(stream, e) {
        _gaq.push(['_trackEvent', 'Streams', 'Refresh Button Click', '']);
        stream.loadMoreNewer();

        mixpanel.track('Refresh Button');
    },

    handleStreamMinimize: function(e, stream) {
        bonzo(stream.render()).addClass('minimized');
        var button = stream.renderButton();
        bonzo(this.toolbarElem).append(button);
        bean.on(button, 'click.toolbar', _.bind(this.handleMinimizedStreamClick, this), button, stream);
    },

    handleMinimizedStreamClick: function(e, button, stream) {
        bonzo(button).detach();
        bean.off(button, 'click.toolbar');
        bonzo(stream.render()).removeClass('minimized');
    }
});

appricot.PostBox = Class.$extend({
    node: null,
    reply_to: null,

    __init__: function(content, reply_to) {
        this.reply_to = reply_to;
        this.content = content;
    },

    render: function() {
        if (!this.node) {
            this.node = document.createElement('div');

            this.textarea = document.createElement('textarea');
            if (this.content) {
                bonzo(this.textarea).val(this.content);
            }
            bean.add(this.textarea, 'keypress', _.bind(this.handleKeyPress, this));
            bean.add(this.textarea, 'keyup', _.bind(this.handleKeyPress, this));

            this.counter = document.createElement('div');
            bonzo(this.counter)
                .addClass('counter')
                .text('256');

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
                .append(this.counter)
                .append(post)
                .append(cancel);

            this.handleKeyPress();
        }

        return this.node;
    },

    handleKeyPress: function(e) {
        bonzo(this.counter).text(256 - parseInt(this.textarea.value.length, 10));
    },

    handlePostButton: function(e) {
        reqwest({
            url: 'https://alpha-api.app.net/stream/0/posts',
            type: 'json',
            method: 'post',
            contentType: 'application/json',
            headers: {
                'Authorization': 'Bearer ' + appricot.ACCESS_TOKEN
            },
            data: JSON.stringify({
                'text': this.textarea.value,
                'reply_to': this.reply_to
            }),
            success: _.bind(this.handlePostSuccess, this),
            error: _.bind(this.handlePostError, this)
        });

        mixpanel.track('Submit Post');
    },

    handleCancelButton: function(e) {
        bonzo(this.node).remove();
        mixpanel.track('Post Cancelled');
    },

    handlePostSuccess: function(data) {
        bonzo(this.node).remove();
    },

    handlePostError: function() {
        mixpanel.track('Post Failed');
    },

    focus: function() {
        this.textarea.focus();
        if (typeof this.textarea.selectionStart == "number") {
            this.textarea.selectionStart = this.textarea.selectionEnd = this.textarea.value.length;
        } else if (typeof this.textarea.createTextRange != "undefined") {
            this.textarea.focus();
            var range = this.textarea.createTextRange();
            range.collapse(false);
            range.select();
        }
    }
});

appricot.Stream = Class.$extend({
    cache: null,
    title: "",
    isFetching: false,
    topOfFirstLoad: 0,
    postNode: null,
    firstLoad: true,
    currentTopPostId: 0,
    rememberPosition: true,

    __init__: function(endpoint, title) {
        this.endpoint = endpoint;
        this.title = title;
        this.cache = [];
    },

    load: function() {
        this.cache = [];
        if (this.firstLoad) {
            this.firstLoad = false;
            if (this.rememberPosition) {
                this.loadPositionFromServer();
                return;
            }
        }
        // var lastPos = window.localStorage['stream_pos_' + this.type];
        if (this.rememberPosition && this.currentTopPostId) {
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
            url: '/go/get_position',
            type: 'json',
            method: 'post',
            data: {
                'access_token': appricot.ACCESS_TOKEN,
                'stream_id': this.type
            },
            success: _.bind(this.handlePositionLoad, this)
        });
    },

    savePositionToServer: _.debounce(function(pos) {
        if (!this.rememberPosition) {
            return;
        }

        reqwest({
            url: '/go/set_position',
            type: 'json',
            method: 'post',
            data: {
                'access_token': appricot.ACCESS_TOKEN,
                'stream_id': this.type,
                'position': pos
            }
        });
    }, 5000),

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
                'count': 100,
                'include_directed_posts': 1
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

            this.minimizeButton = document.createElement('img');
            bonzo(this.minimizeButton)
                .addClass('minimizeButton')
                .attr('src', '/images/glyphicons/png/glyphicons_214_resize_small.png')
                .attr('title', 'Throw to sidebar');
            bean.on(this.minimizeButton, 'click', _.bind(this.handleMinimizeButtonClick, this));

            bonzo(this.statusBar)
                .addClass('statusbar');
            bonzo(this.node)
                .append(this.statusBar)
                .append(this.minimizeButton);
            bean.on(this.statusBar, 'click', _.bind(this.handleStatusBarClick, this));

            this.postNode = document.createElement('div');
            bonzo(this.postNode).addClass('stream_post_container');
            bonzo(this.node).append(this.postNode);
            bean.add(this.postNode, 'scroll', _.bind(_.debounce(this.handleScroll, 100), this));
        }

        return this.node;
    },

    renderButton: function() {
        if (!this.button) {
            this.button = document.createElement('button');
            bonzo(this.button)
                .addClass('btn')
                .attr('title', this.title)
                .html("<i class='icon-list'></i>");
        }

        return this.button;
    },

    handleStatusBarClick: function(e) {
    },

    handleMinimizeButtonClick: function(e) {
        bean.fire(this, 'minimize');
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

        this.updateNewerPostCount();

        var wrappedNode = bonzo(this.postNode);
        if (wrappedNode.scrollTop() >= this.postNode.scrollHeight - wrappedNode.offset().height - 10) {
            this.loadMorePrevious();
        }
    },

    updateNewerPostCount: function(force_render) {
        var count = 0;
        if (this.cache.length > 0) {
            var scrollTop = bonzo(this.postNode).scrollTop();
            var topPost = _.find(this.cache, function(item) {
                if(item.render().offsetTop >= scrollTop) {
                    return true;
                }
                count++;
            }, this);

            var wasChanged = this.currentTopPostId != topPost.id;

            // Update if the top post changed OR we're forcing an update.
            if (wasChanged || force_render) {
                this.updateStatus(count);

                // Only update the server IF we actually changed top post (might just be updating UI).
                if (wasChanged) {
                    this.savePositionToServer(topPost.id);
                    this.currentTopPostId = topPost.id;
                }
            }
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

        data = _.filter(data, function(item) {
            return (!item.is_deleted);
        });

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

        this.updateNewerPostCount(true);

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
        this.$super('https://alpha-api.app.net/stream/0/posts/stream', 'My Stream');
    }
});

appricot.GlobalStream = appricot.Stream.$extend({
    type: 'globalstream',
    rememberPosition: false,

    __init__: function() {
        this.$super('https://alpha-api.app.net/stream/0/posts/stream/global', 'Global');
    }
});

appricot.MentionStream = appricot.Stream.$extend({
    type: 'mentionstream',

    __init__: function() {
        this.$super('https://alpha-api.app.net/stream/0/users/me/mentions', 'Mentions');
    }
});


appricot.Post = Class.$extend({
    post: null,
    repostPost: null,
    node: null,
    id: 0,

    __init__: function(post) {
        if (post.repost_of) {
            this.post = post['repost_of'];
            this.repostPost = post;
        } else {
            this.post = post;
        }
        this.id = parseInt(this.post.id, 10);
    },

    render: function() {
        if (!this.node) {
            this.node = document.createElement('div');

            bean.add(this.node, 'click', _.bind(this.handleRowClick, this));

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

            // Clean up HTML first. Work through it and increment positions.
            var addedCharCount = 0;
            var cleanPos = 0;
            _.each(entities, function(elem, index, list) {
                // Push the pos up by how much we've already mucked in the string.
                elem.pos += addedCharCount;

                var originalContent = content.substring(cleanPos, elem.pos);
                var cleanContent = _.escape(originalContent);

                var elemContent = content.substring(elem.pos, elem.pos + elem.len);

                var elemContentClean = _.escape(elemContent);

                var contentSizeIncrease = elemContentClean.length - elemContent.length;

                content = content.substring(0, cleanPos) + cleanContent + elemContentClean + content.substring(elem.pos + elem.len);

                addedCharCount += cleanContent.length - originalContent.length;
                elem.pos += cleanContent.length - originalContent.length;

                addedCharCount += contentSizeIncrease;
                elem.len += contentSizeIncrease;

                cleanPos = elem.pos + elem.len;
            }, this);

            // Fallback for anything not preceeding an entity.
            content = content.substring(0, cleanPos) + _.escape(content.substring(cleanPos));

            entities.reverse();

            // Apply them.
            _.each(entities, function(elem, index, list) {
                content = content.substring(0, elem.pos) + elem.html + content.substring(elem.pos + elem.len);
            }, this);

            var date = new Date(this.post.created_at);
            bonzo(this.node)
                .addClass('post row-fluid')
                .html(Mustache.render("<div class='span1'><img class='avatar' src='{{post.user.avatar_image.url}}' /></div><div class='span11'><div class='row-fluid'><div class='span5'><b><a href='https://alpha.app.net/{{post.user.username}}' target='_blank'>{{post.user.username}}</a></b></div><div class='span6'><a href='https://alpha.app.net/{{post.user.username}}/post/{{post.id}}' target='_blank'>{{date}}</a></div></div><div class='row-fluid post_content'>{{&content}}</div><div class='row-fluid post_notes'>{{post_notes}}</div></div>", {
                    post: this.post,
                    content: content.replace(/\n/g, "<br>"),
                    date: date.toDateString() + " " + date.toLocaleTimeString(),
                    post_notes: (this.repostPost ? 'reposted by ' + this.repostPost.user.name : '')
                }));

            var actions = document.createElement('div');

            var reply = document.createElement('img');
            bonzo(reply)
                .addClass('reply')
                .attr('src', '/images/glyphicons/png/glyphicons_221_unshare.png')
                .attr('title', 'Reply');
            bean.add(reply, 'click', _.bind(this.handleReplyClick, this));

            var repost = document.createElement('img');
            bonzo(repost)
                .addClass('repost')
                .attr('src', '/images/glyphicons/png/glyphicons_176_forward.png')
                .attr('title', 'Quoted Repost');
            bean.add(repost, 'click', _.bind(this.handleRepostClick, this));

            var nativeRepost = document.createElement('img');
            bonzo(nativeRepost)
                .addClass('nativeRepost')
                .attr('src', '/images/glyphicons/png/glyphicons_080_retweet.png')
                .attr('title', 'Repost');
            bean.add(nativeRepost, 'click', _.bind(this.handleNativeRepostClick, this));

            bonzo(actions)
                .addClass('actions')
                .append(reply)
                .append(repost)
                .append(nativeRepost);

            bonzo(this.node)
                .append(actions);
        }

        return this.node;
    },

    handleReplyClick: function(e) {
        var post = new appricot.PostBox('@' + this.post.user.username + ' ', this.id);
        bonzo(document.body).append(post.render());
        post.focus();

        mixpanel.track('Click Reply Button');
    },

    handleRepostClick: function(e) {
        var post = new appricot.PostBox('\u00BB @' + this.post.user.username + ': ' + this.post.text, this.id);
        bonzo(document.body).append(post.render());
        post.focus();

        mixpanel.track('Click Repost Button');
    },

    handleNativeRepostClick: function(e) {
        reqwest({
            url: 'https://alpha-api.app.net/stream/0/posts/' + this.post.id + '/repost',
            type: 'json',
            method: 'post',
            headers: {
                'Authorization': 'Bearer ' + appricot.ACCESS_TOKEN
            },
            data: {
                'post_id': this.post.id
            }
        });
    },

    handleRowClick: function(e) {
        if (e.target.tagName.toLowerCase() == 'a') {
            return;
        }
        var post = bonzo(this.node);
        if (post.hasClass('reveal')) {
            post.removeClass('reveal');
        } else {
            post.addClass('reveal');
        }
    }
});
