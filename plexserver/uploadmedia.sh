#!/bin/bash 
# NOTE: this script must be chmod +x'd and executed as ./uploadmedia.sh 

while read path 
do 
	echo $path;
	node ./bin/cli-upload.js "TV Shows" "$path"
done < <(node bin/cli-haveprocessed.js /mnt/gdrive-mount/plex-data/TV/Archer\ \(2009\)/ tv)
