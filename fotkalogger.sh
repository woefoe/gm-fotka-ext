#!/bin/bash

logs_dir="/data/bak/fotka"
traces_dir="/tmp/fotka"
owner="$(whoami)"

get_logname () { cut -d $'\t' -f 1; }
get_date () { cut -d $'\t' -f 2; }
get_login_and_message () { cut -d $'\t' -f 3,4; }

get_log_path () { echo "${logs_dir}/$(date '+%Y%m%d').$1.txt"; }
get_traces_path () { echo "${traces_dir}/$1.trace.txt"; }
is_older_than () { [ "$(stat --format=%Y "$1")" -le "$(( $(date +%s) - $2 ))" ]; }

mkdir -p "$logs_dir" "$traces_dir"

traces_max=20

chown "$owner":"$owner" "$logs_dir" "$traces_dir"

# while listening on socket, process the lines
websocat -s 8085 | while read -r line; do
    logname=$(echo "$line" | get_logname)
    log_path=$(get_log_path "$logname")
    traces_path=$(get_traces_path "$logname")

    # if log already exists and is and trace doesn't or is old, let's initialize buffer with it's
    # last few lines
    if [ -f "$log_path" ] && { ! [ -f "$traces_path" ] || is_older_than "$log_path" 600; }; then
        tail -n "$traces_max" "$log_path" | get_login_and_message > "$traces_path"
    fi

    # we drop timestamp, because it's client that adds it
    stripped_line=$(echo "$line" | get_login_and_message)

    # drop lines that are repeated in traces file
    if ! [ -f "$traces_path" ]; then
        touch traces_path
    elif grep -F "$stripped_line" "$traces_path"; then
        continue
    fi

    # remove first line from the traces file
    traces_now=$(wc -l < "$traces_path")
    if [ "$traces_now" -ge "$traces_max" ]; then
        sed -i 1d "$traces_path"
    fi

    date=$(echo "$line" | get_date)

    echo "$stripped_line" >> "$traces_path"
    printf "%s\t%s\n" "$date" "$stripped_line" >> "$log_path"
done
