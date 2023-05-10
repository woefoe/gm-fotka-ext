# gm-fotka-ext

This greasemonkey scripts helps to deal with toxic environment on fotka, without breaking terms of service. Everything is done using javascript/DOM events and there are no direct calls to servers performed. But anyway use at Your own risks.

## Features:

* user blocking – remove these pesky messages from annoying users while being to talk with ones You like.
  * in chat messages
  * in chat userlist
  * in live stream chat
* highlighting mentons extended – specify additional patterns that you want to make message marked as mentioning You
* logging – logging to local file using websockets and a service running in background
  * chat – log chat messages
  * users – log who's currently online
* user aliases – alias annoying and offensive user names
* customization:
  * font – set site-wide font to use, because the default can be bad for the eyes
  * background – set the background, this is useful when Your darkening plugin has trouble with gradient background
  * chat star scale – set scale of oversized chat premium icon, that covers beautiful avatars
* hide popup messages (experimental) – hide popup toasts about users viewing your profile. This is experimentable and mostly doesnt work.
* hide simp buttons – hide buttons meant for simps

Tested to work on Qutebrowser and on Firefox with Tampermonkey plugin.

## Installing

### Firefox

1. Install Tampermonkey addon.
2. Click Tampermonkey icon, select `Create a new script...`
3. Paste contents of gm-fotka-ext.js into the window replacing all contents.
4. Customize the options – adjust cfg, read comments, check mentionPatterns, userAliases, blockedUsers.
5. Save the plugin.
6. Reload Your chat tab.

### Qutebrowser

1. Copy script into `~/.config/qutebrowser/greasemonkey` folder
2. Edit it with editor of your choice – adjust cfg, read comments, check mentionPatterns, userAliases, blockedUsers.
3. Save the file.
4. Type `:greasemonkey-reload` and then `:reload` to reload greasemonkey scripts and the tab.

## Making logging work

This is only tested on linux. If You have a log capturing application for windows, do let me know, but anyway.

```shell
cp fotkalogger.sh /usr/local/bin/fotkalogger.sh
cp fotkalogger.service ~/.config/systemd/user/fotkalogger.service
systemctl --user enable --now fotkalogger.service
```

Make sure the service is running (check status with `systemctl status fotkalogger` and logs with `journalctl -u fotkalogger`)
Now You can specify websocket address in Your configuration. Find `cfg.logChatUrl` and set it to `ws://127.0.0.1:8085`.

Reload and viola!

## Todo-maybes

* Censoring avatars
* Logging of live stream messages
