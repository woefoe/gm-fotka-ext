# gm-fotka-ext

This greasemonkey scripts helps to deal with toxic environment on fotka, without breaking terms of service. Everything is done using javascript/DOM events and there are no direct calls to servers performed. But anyway use at Your own risks.

## Features:

* user blocking – remove these pesky messages from annoying users while being to talk with ones You like.
  * in chat messages
  * in chat userlist
  * in live stream chat
* highlighting mentons extended – specify additional patterns that you want to make message marked as mentioning You
* logging chat – log chat to a file using websockets and local service
* user aliases – alias annoying and offensive user names
* customization:
  * font – set site-wide font to use, because the default can be bad for the eyes
  * background – set the background, this is useful when Your darkening plugin has trouble with gradient background
  * chat star scale - set scale of oversized chat premium icon, that covers beautiful avatars
* hide popup messages (experimental) – hide popup toasts about users viewing your profile. This is experimentable and mostly doesnt work.
* hide simp buttons – hide buttons meant for simps

Tested to work on Qutebrowser and on Firefox with Tampermonkey plugin.
