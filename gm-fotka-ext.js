// ==UserScript==
// @name        Fotka customizer
// @namespace   https://openuserjs.org/scripts/freeos
// @version     1.0
// @author      -
// @description Clean up Fotka UI and filter annoying users.
// @license     MIT; https://opensource.org/licenses/MIT
// @include     https://*.fotka.com/*
// @include     https://fotka.com/*
// @grant       GM_addStyle
// ==/UserScript==

let cfg = {
  background: "black",                      // background of the page is a gradient by default and dark mode tends not to handle it well
  fontFamily: "Sans",                       // better web font
  gwiazdaScale: 0.6,                        // scale of a star icon in chat
  blockInterval: 1000,                      // interval of filtering messages and users
  logUsersInterval: 30000,                  // interval of user logging
  liveChatInterval: 1000,                   // interval on processing live chat messages
  hidePopupMessages: true,                  // hide popups about swearing in chat
  hideSimpButtons: true,                    // hide buttons for simps like "Tak i Nie", "Ranking"
  hideUsersChatMessages: true,              // hide messages list in chat
  filterUsersInChatUsersInterval: true,     // hide users in user list of chat in interval
  filterUsersInChatUsersOnDom: true,        // hide users in userlist on DOM insertion event
  filterUsersInLiveChat: true,              // hide users in live stream chat
  logChatUrl: ""                            // address to send logs over over websocket (in ws://... format), disabled if empty
}

let lognamePatterns = [
  /^\/(czat)\/(\w+)$/,
  /^\/(kamerka)\/(.*)$/
]

// highlight additional mentions (case sensitive/regexp)
let mentionPatterns = [
  /\b[mM]i[lł]osz/
]

// alternative names for users
let userAliases = {
  niezesrajsie: "daniel"
}

// Contains list of users that You don't want to see in chat if filtering is enabled
let blockedUsers = [
  "AdaszewskaK",
  "awworeo",
  /as[0-9]\+/
]

let hideClass = 'displayNoneImportant'

let maxMessages = 2048
let messagesQueue = []

const messageRegexp = /([\w\(\)]+:\n?)(.*)$/

// helper functions
function load_script(url, callback)
{
    // adding the script element to the head as suggested before
   var head = document.getElementsByTagName('head')[0];
   var script = document.createElement('script');
   script.type = 'text/javascript';
   script.src = url;

   // then bind the event to the callback function 
   // there are several events for cross browser compatibility
   script.onreadystatechange = callback;
   script.onload = callback;

   // fire the loading
   head.appendChild(script);
}

function get_timestamp() {
  let date = new Date()
  let dateStr = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
  let timeStr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()
  return dateStr + 'T' + timeStr
}

function add_message(logname, date, login, message) {
  if (messagesQueue.length > 2048) {
    console.warn("Dropping message due to buffer overflow");
    messagesQueue.pop();
  }
  messagesQueue.push(logname + "\t" + date + "\t" + login + "\t" + message)

  var ws = new WebSocket(cfg.logChatUrl)
  ws.addEventListener("open", () => {
    console.debug("logger: Connected")
    while (messagesQueue.length > 0) {
      message = messagesQueue.pop()
      console.log("logger: Sending message", message);
      ws.send(message + "\n")
    }
    ws.close()
  })
  ws.addEventListener("close", () => {
    console.debug("logger: Disconnected")
  })
  ws.addEventListener("error", (event) => { console.warn("logger error: ", event) })
}

function mark_message_as_mention(target) {
  var mentionClass = "message-to-me";
  target.find(".cloud-arrow-border").addClass(mentionClass)
  target.find(".cloud-arrow-border-arrow").addClass(mentionClass)
  target.find(".cloud-container-body").addClass(mentionClass)
}

function log_chat_users() {
  var $users = $("#users-list .chatLogin")
  var users = ""
  for (var i = 0; i < $users.length; ++i) {
    if (i !== 0) {
      users += " "
    }
    users += $users[i].textContent;
  }
  add_message(get_logname() + ".users", get_timestamp(), "_", users)
}

function matches_any_pattern(patterns, value) {
  for (var i = 0; i < patterns.length; ++i) {
    var matches = value.match(patterns[i])
    if (matches) {
      return matches
    }
  }
  return null
}

function get_logname() {
  var matched = matches_any_pattern(lognamePatterns, location.pathname)
  if (matched) {
    return matched[1] + '.' + matched[2]
  }
  return "czat.Glowny"
}

// handlers
function dom_userlist_handler(event) {
  // this doesn't quite seem to work :)
  var $target = $(event.target)
  var $login = $target.find(".user-login")[0]
  if (typeof $login === "undefined") {
    return
  }
  var login = $login.textContent
  var loginLower = login.toLowerCase().trim();

  if (matches_any_pattern(blockedUsers, loginLower)) {
    console.log("Hiding user " + loginLower + " from chat userlist")
    $target.addClass(hideClass)
  }

  // apply user name aliases
  if (login in userAliases) {
    $target.find(".chatLogin").text(userAliases[login])
  }
}

function dom_popup_handler(event) {
  let $target = $(event.target)
  if (event.target.contains("img") && event.target.contains("svg")) {
    console.log("Hiding popup \"" + event.target.textContent + "\"")
    $target.addClass(hideClass)
  }
}

function dom_chat_handler(event) {
  let $target = $(event.target)
  let login = $target.attr("login")
  let message = messageRegexp.exec(event.target.textContent.trim())[2]
  var logname = get_logname()

  // log messages
  add_message(logname, get_timestamp(), login, message)

  // handle mentions
  if (matches_any_pattern(mentionPatterns, message)) {
    mark_message_as_mention($target)
  }

  // apply user name aliases
  if (login in userAliases) {
    $target.find(".cloud-container-body-login").text(userAliases[login])
  }
}

function remove_user_from_chat(login) {
  GM_addStyle(`
      div[login=` + login + `],
      div[login=` + login.toLowerCase() + `] {
        display: none;
      }`)
}

function filter_chat_users() {
  var userNodes = $("#users-list > * > div.chat-user .user-login")
  for (var j = 0; j < userNodes.length; ++j) {
    var userNode = userNodes[j];
    var login = userNode.textContent.toLowerCase()
    if (matches_any_pattern(blockedUsers, login) &&
        !($(userNode).parent().hasClass(hideClass))) {
      console.log("Hiding user " + login + " from user list")
      $(userNode).parent().addClass(hideClass)
    }
  }
}

function get_live_chat_messages() {
  var chatNodes = $("#streams > div > :nth-child(2) > :nth-child(2) > div > div > div")
  var chatMessages = []
  for (var i = 0; i < chatNodes.length; ++i) {
    var $node = $(chatNodes[i]);
    var $subnode = $node.find("> div > div:nth-child(1) > div:nth-child(2)")
    var login = $subnode.find("> div:nth-child(1) > div").text().trim()
    var message = $subnode.find("> div:nth-child(2) > div").text().trim()
    chatMessages.push({ login: login, message: message, node: $node })
  }
  return chatMessages;
}

function process_live_chat() {
  var oldMessages = []
  var curMessages = get_live_chat_messages()
  var newMessages = []

  if (localStorage.liveChatMessages) {
    oldMessages = JSON.parse(localStorage.liveChatMessages)
  }

  // current messages not in old messages are new messages
  for (var i = 0; i < curMessages.length; ++i) {
    var curMessage = curMessages[i]
    if (!oldMessages.find(oldMessage => oldMessage.message == curMessage.message)) {
      newMessages.push(curMessage)
    }
  }

  for (var i = 0; i < newMessages.length; ++i) {
    newMessage = newMessages[i]
    // we probably want to log new messages...
    add_message(get_logname(), get_timestamp(), newMessage.login, newMessage.message)

    // and then filter out the ones we don't want
    if (cfg.filterUsersInLiveChat) {
      if (matches_any_pattern(blockedUsers, newMessage.login)) {
        console.log("Hiding message from user " + newMessage.login + " from stream messages")
        newMessage.node.addClass(hideClass)
      }
    }
  }

  // nodes can't be stringified, so we clear them
  for (var i = 0; i < curMessages.length; ++i) {
    curMessage = curMessages[i]
    delete curMessage.node
  }

  localStorage.liveChatMessages = JSON.stringify(curMessages)
}

function filter_blocked() {
  if (cfg.filterUsersInChatUsersInterval) {
    filter_chat_users()
  }
}

function apply_css() {
  GM_addStyle(`
    body {
      background: ` + cfg.background + ` !important;
      font-family: ` + cfg.fontFamily + ` !important;
    }
    .displayNoneImportant {
      display: none !important;
    }
    .gwiazda-tlo {
      -webkit-transform: translateZ(0) scale(` + cfg.gwiazdaScale + ", " + cfg.gwiazdaScale + `) !important;
    }`)

  if (cfg.hidePopupMessages) {
    GM_addStyle(`
    div#messageBoxOverlay {
      display: none;
    }`)
  }

  if (cfg.hideSimpButtons) {
    GM_addStyle(`
    a[href=\\/glosy\\/taknie],
    a[href=\\/gry],
    a[href=\\/najnowsze],
    a[href=\\/online],
    a[href=\\/profil],
    a[href=\\/ranking]
    { display: none; }`)
  }

  if (cfg.hideUsersChatMessages) {
    for (var i=0; i < blockedUsers.length; ++i) {
      var userPattern = blockedUsers[i]
      remove_user_from_chat(userPattern)
    }
  }
}

function on_doc_ready() {
  if (document.domain.indexOf("fotka.com") === -1) {
    return
  }

  if (typeof jQuery === 'undefined') {
    load_script('https://code.jquery.com/jquery-3.6.4.slim.js', initialize)
  } else {
    initialize()
  }
}

function initialize() {
  apply_css()

  if (cfg.hidePopups) {
    $("body").on("DOMNodeInserted", "body > div", dom_popup_handler)
  }

  // TODO color picker with your own colors
  //      $('#colorPicker').addElement(`
  //  <input id="colorPickerField" />
  //      `).onChange(
  //          //verify it's color, update
  //          //FotkaChat.ColorPicker.colorSelect(this)
  //      )

  var intervalTarget
  if (unsafeWindow === null) {
    intervalTarget = window
  } else {
    intervalTarget = unsafeWindow
  }

  if (location.pathname.startsWith('/kamerka')) {
    intervalTarget.setInterval(process_live_chat, 1000)
    intervalTarget.setInterval(process_live_chat, cfg.liveChatInterval)
  }

  if (location.pathname.startsWith('/czat')) {
    if (cfg.filterUsersInChatUsersOnDom) {
      $("#users-list").on("DOMNodeInserted", ".chat-user", dom_userlist_handler)
    }

    if (cfg.logChatUrl.length > 0) {
      $("#chat #message-box").on("DOMNodeInserted", ".cloud", dom_chat_handler)
    }

    intervalTarget.setTimeout(filter_blocked, 1000)
    intervalTarget.setTimeout(log_chat_users, 1000)
    intervalTarget.setInterval(filter_blocked, cfg.blockInterval)
    intervalTarget.setInterval(log_chat_users, cfg.logUsersInterval)
  }

  // TODO working hiding notiffications
  //$("body").bind("DOMNodeInserted", function() {
  //  child = $("body > div:last-of-type")
  //  id = child.attr("id")
  //  if ((typeof(id) == "undefined") || (id.match("colorPicker.*") > 0)) {
  //    console.log(child.html())
  //  }
  //});
}

if (document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) {
  on_doc_ready()
} else {
  document.addEventListener("DOMContentLoaded", on_doc_ready)
}
