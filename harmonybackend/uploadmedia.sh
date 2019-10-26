#!/bin/bash 
# NOTE: this script must be chmod +x'd and executed as ./uploadmedia.sh 

mkdir -p ./.upload-logs/

while read path 
do 
	echo $path;
	node ./bin/cli-upload.js "Movies" "$path" | tee 
done < <(node bin/cli-haveprocessed-v2.js /mnt/gdrive/plex-data/Movies movies --sort-newest-first)
