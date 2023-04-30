#!/bin/sh

logs_dir="/data/bak/fotka"
traces_dir="/tmp/fotka"
log_path="$logs_dir/$(date '+%Y%m%d').txt"
traces_path="$traces_dir/traces.txt"
owner=$(whoami)

strip_date() { cut -d $'\t' -f 2-; }

mkdir -p "$logs_dir" "$traces_dir"

traces_max=20
# if log already exists, let's initialize buffer with it
if [ -f "$log_path" ]; then
    tail -n "$traces_max" "$log_path" | strip_date > "$traces_path"
fi

touch "$log_path" "$traces_path"
chown $owner:$owner "$logs_dir" "$traces_dir" "$log_path" "$traces_path"

# while listening on socket, process the lines
websocat -s 8085 | while read -r line; do

    # we drop timestamp, because it's client that adds it
    stripped_line=$(echo "$line" | strip_date)

    # drop lines that are repeated in traces file
    if grep -F "$stripped_line" "$traces_path"; then
        continue
    fi

    # remove first line from the traces file
    traces_now=$(wc -l < "$traces_path")
    if [ "$traces_now" -ge "$traces_max" ]; then
        sed -i 1d "$traces_path"
    fi

    echo "$stripped_line" >> "$traces_path"
    echo "$line" >> "$log_path"
done
