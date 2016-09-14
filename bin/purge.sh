#!/bin/bash

# the following example, if you set variable CMD to "rm"
# running the script will delete the less recently used files from DIR,
# (if atime is supported by the filesystem and not disabled at mount time)
# until the used space in bytes for DIR fall below MAX

# USE WITH EXTREME CAUTION !!!

set -e

CMD=ls 
DIR=cache
MAX=$((1024*1024*1024*8)) # 8Gb
USED=$(du -bs cache | cut -f 1)

[ $USED -le $MAX ] && exit

find cache -type f -printf "%A@ %s %p\n" | sort | while read l ; do
  f=($l)
  $CMD ${f[2]}
  USED=$((USED-f[1]))
  [ $USED -le $MAX ] && break
done
