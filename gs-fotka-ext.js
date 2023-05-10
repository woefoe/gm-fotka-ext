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
  target.children(".cloud-arrow-border").addClass(mentionClass)
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

// handlers
function dom_userlist_handler(event) {
  // this doesn't quite seem to work :)
  var $target = $(event.target)
  var login = $(event.target).children(".user-login")[0].textContent
  var login_lower = login.toLowerCase().trim();
  for (var i = 0; i < blockedUsers.length; ++i) {
    var userPattern = blockedUsers[i];
    var matches = userPattern.match(login_lower)
    if (matches) {
      console.log("Hiding user " + userPattern + " from chat userlist")
      $target.addClass(hideClass)
    }
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

function get_logname() {
  let logname = "czat.Glowny"
  for (var i = 0; i < lognamePatterns.length; ++i) {
    let lognamePattern = lognamePatterns[i]
    let matched = location.pathname.match(lognamePattern)
    if (matched !== null) {
      logname = matched[1] + '.' + matched[2]
    }
  }
  return logname
}

function dom_chat_handler(event) {
  let $target = $(event.target)
  let login = $target.attr("login")
  let message = messageRegexp.exec(event.target.textContent.trim())[2]
  var logname = get_logname()

  // log messages
  add_message(logname, get_timestamp(), login, message)

  // handle mentions
  for (var i = 0; i < mentionPatterns.length; ++i) {
    var mentionPattern = mentionPatterns[i]
    if (message.search(mentionPattern) !== -1) {
      mark_message_as_mention($target)
    }
  }

  // apply user name aliases
  if (login in userAliases) {
    $target.find(".cloud-container-body-login").text(userAliases[login])
  }
}

function on_doc_ready(){
  if (document.domain.indexOf("fotka.com") !== -1) {
    apply_css()

    if (cfg.hidePopups) {
      $("body").on("DOMNodeInserted", "body > div", dom_popup_handler)
    }

    if (cfg.filterUsersInChatUsersOnDom) {
      $("#users-list").on("DOMNodeInserted", ".chat-user", dom_userlist_handler)
    }

    if (cfg.logChatUrl.length > 0) {
      $("#chat #message-box").on("DOMNodeInserted", ".cloud", dom_chat_handler)
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
      intervalTarget = window;
    } else {
      intervalTarget = unsafeWindow;
    }

    var filterBlockedIntervalId = intervalTarget.setInterval(function () { filter_blocked(); }, cfg.blockInterval)
    GM_setValue("filterBlockedInterval", filterBlockedIntervalId);
    var logUsersIntervalId =  intervalTarget.setInterval(function () { log_users(); }, cfg.logUsersInterval)
    GM_setValue("logUsersInterval", logUsersIntervalId);

    // TODO working hiding notiffications
    //$("body").bind("DOMNodeInserted", function() {
    //  child = $("body > div:last-of-type")
    //  id = child.attr("id")
    //  if ((typeof(id) == "undefined") || (id.match("colorPicker.*") > 0)) {
    //    console.log(child.html())
    //  }
    //});
  }
}

function remove_user_from_live_chat(login) {
  var chatNode = $("#streams > div > :nth-child(2) > :nth-child(2) > div > div")
  for (var j=0; j < chatNode.length; ++j) {
    var child = chatNode.children[j];
    if (child.textContent.toLowerCase().match("\s*" + login.toLowerCase()).length > 0 &&
        !($(child).hasClass(hideClass))) {
      console.log("Hiding message from user " + login + " from stream messages")
      $(child).addClass(hideClass)
    }
  }
}

function remove_user_from_chat(login) {
  GM_addStyle(`
      div[login=` + login + `],
      div[login=` + login.toLowerCase() + `] {
        display: none;
      }`)
}

function remove_user_from_chat_users(login) {
  var userNodes = $("#users-list > * > div.chat-user .user-login")
  for (var j = 0; j < userNodes.length; ++j) {
    var userNode = userNodes[j];
    if (userNode.textContent.toLowerCase().match("^" + login.toLowerCase() + "$") &&
        !($(userNode).parent().hasClass(hideClass))) {
      console.log("Hiding user " + login + " from user list")
      $(userNode).parent().addClass(hideClass)
    }
  }
}

function filter_blocked() {
  if (typeof jQuery === 'undefined') {
    // If JQuery is not available, there's no frequently updated content
    console.log("jQuery is not available, filtering inactive");

    // stop loop if there is one
    var id = GM_getValue("filterBlockedInterval", null)
    if (id > 0) {
      console.log("Stopping loop")
      if (unsafeWindow === null) {
        window.clearInterval(id);
      } else {
        unsafeWindow.clearInterval(id)
      }
      GM_setValue("filterBlockedInterval", 0)
    }
    return;
  }

  for (var i=0; i < blockedUsers.length; ++i) {
    var userPattern = blockedUsers[i]

    // Filter chat in streams
    if (cfg.filterUsersInLiveChat) {
      remove_user_from_live_chat(userPattern)
    }

    // Filter user list in chat
    if (cfg.filterUsersInChatUsersInterval) {
      remove_user_from_chat_users(userPattern)
    }
  }
}

function log_users() {
  if (typeof jQuery === 'undefined') {
    // If JQuery is not available, there's no frequently updated content
    console.log("jQuery is not available, filtering inactive");

    // stop loop if there is one
    var id = GM_getValue("logUsersInterval", null)
    if (id > 0) {
      console.log("Stopping loop")
      if (unsafeWindow === null) {
        window.clearInterval(id);
      } else {
        unsafeWindow.clearInterval(id)
      }
      GM_setValue("logUsersInterval", 0)
    }
    return;
  }

  if (location.pathname.startsWith('/czat')) {
    log_chat_users()
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

if (document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) {
  on_doc_ready()
} else {
  document.addEventListener("DOMContentLoaded", on_doc_ready)
}
