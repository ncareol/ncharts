#!/bin/sh

dest=$(dirname $0)

dest=$(readlink -f $dest)

dest=$dest/ncharts/static/ncharts

[ -d $dest ] || mkdir -p $dest
[ -d $dest/js ] || mkdir -p $dest/js
[ -d $dest/js/modules ] || mkdir -p $dest/js/modules

echo "Downloading and copying static files to $dest"

tmpdir=$(mktemp -d /tmp/ncharts_static_XXXXXX)
trap "{ rm -rf $tmpdir; }" EXIT

cd $tmpdir
bower --allow-root install jquery || exit 1
bower --allow-root install bootstrap || exit 1
bower --allow-root install moment || exit 1
bower --allow-root install moment-timezone || exit 1

rsync -rv bower_components/jquery/dist/ $dest/js || exit 1
rsync -rv bower_components/bootstrap/dist/ $dest || exit 1

rsync -rv bower_components/moment/min/moment.min.js $dest/js || exit 1
rsync -rv bower_components/moment-timezone/builds/moment-timezone-with-data.min.js $dest/js || exit 1

# This gets git://github.com/robdodson/highcharts.com.git, which I'm not sure I want
# bower install highstock
# We'll get what we want from highcharts.com with curl -O


# Either can get the full highcharts zip files, or get just what we want.
# For now, just get what we want.
do_zip=false
if $do_zip; then

    # download zip files
    # www.highcharts/com/download
    curl -O code.highcharts.com/zips/Highcharts.zip || exit 1
    curl -O code.highcharts.com/zips/Highstock.zip || exit 1
    mkdir highcharts
    cd highcharts

    unzip ../Highcharts.zip > /dev/null
    rsync -rv js $dest || exit 1

    cd -

    mkdir highstock
    cd highstock

    unzip ../Highstock.zip > /dev/null
    rsync -rv js/highstock*.js $dest/js || exit 1
    cd -
else
    curl -O code.highcharts.com/stock/highstock.js || exit 1
    curl -O code.highcharts.com/stock/modules/exporting.js || exit 1
    curl -O code.highcharts.com/stock/modules/heatmap.js || exit 1
    rsync -rv highstock.js $dest/js || exit 1
    rsync -rv exporting.js $dest/js/modules || exit 1
    rsync -rv heatmap.js $dest/js/modules || exit 1
fi

echo "On a production server, you should run the static.sh script, which basically does python3 manage.py collectstatic
"
