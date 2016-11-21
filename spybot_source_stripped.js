var SlackClient = require('@slack/client');

//**** add Slack API token here ****
var token = process.env.SLACK_API_TOKEN || 'your token here';

var web = new SlackClient.WebClient(token);
var rtm = new SlackClient.RtmClient(token, {logLevel: 'information'});

var global = {};
var userCache = {};

var CLIENT_EVENTS = SlackClient.CLIENT_EVENTS;
var RTM_EVENTS = SlackClient.RTM_EVENTS;
var RTM_CLIENT_EVENTS = CLIENT_EVENTS.RTM;

function getUserInfo(userId, cb) {
  if (userCache[userId]) {
      cb(userCache[userId]);
  } else {
    console.log('Looking up user detail')
    web.users.info(userId, function(err, userInfo) {
      if (userInfo && userInfo.ok) {
        userCache[userId] = userInfo.user;
        return cb(userInfo.user);
      }
    });
  }
}

function narkOn(o) {
  if (!global.reportToChannelId)
    return;

  getUserInfo(o.user, function(u) {
    var msg = u.name + (o.presence == 'active' ? ' logged in' : ' logged out');
    console.log(msg);
    web.chat.postMessage(global.reportToChannelId, msg);
  });
}

function reportToUser(userName, cb) {
  console.log('Getting user list');
  web.users.list(function (err, info) {
    if (info && info.ok) {
      for (var i = 0; i < info.members.length; i++) {
        var user = info.members[i];
        if (user.name == userName) {
          if (cb) {
            cb(user.id);
          }

          console.log('Found @' + userName);
          return;
        }
      }
    }
    console.log('Did not find the user named @' + userName);
  });
}

function reportToChannel(channelName, cb) {
  console.log('Getting channel list')
  return web.channels.list(function(err, info) {
    if (info && info.ok) {
      for (var i = 0; i < info.channels.length; i++) {
        var channel = info.channels[i];
        if (channel.name == channelName) {
          if (cb) {
            cb(channel.id);
          }

          console.log('Found #' + channelName + ' channel');
          return;
        }
      }
    }

    console.log('Did not find the #' + channelName + ' channel =[');
  });
}

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  if (!global.init) {
    console.log('AUTHENTICATED');

    //**** Add in channel name here for reporting - must be public :( ****
    reportToChannel('timekeeper', function(id) {
      global.reportToChannelId = id;
    });// reportToChannel('timekeeper');

    // you need to wait for the client to fully connect before you can send messages
    rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function (o) {
      if (!global.init) {
        console.log('CONNECTED: ');

        rtm.on(RTM_EVENTS.PRESENCE_CHANGE, function (o) {
            narkOn(o);
        });

        rtm.on(RTM_EVENTS.MANUAL_PRESENCE_CHANGE, function (o) {
            narkOn(o);
        });

        if (global.reportToChannelId) {
          web.chat.postMessage(global.reportToChannelId, 'Ready to nark!');
        }

        global.init = true;
      }
    });
  }
});

rtm.start();
