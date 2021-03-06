#!/bin/sh

prod=true
[ $# -gt 0 -a "$1" == -d ] && prod=false

if $prod; then
    DJROOT=${DJROOT:-/var/django}
    DJVIRT=${DJVIRT:-$DJROOT/virtualenv/django}
    export DJANGO_SETTINGS_MODULE=datavis.settings.production
    sudo chmod -R g+w /var/lib/django
    sudo chmod -R g+w /var/log/django
else
    DJVIRT=${DJVIRT:-$HOME/virtualenvs/django}
fi

[ $VIRTUAL_ENV ] || source $DJVIRT/bin/activate


for f in timezones.json projects.json platforms.json variables.json; do
    echo $f
    python3 manage.py loaddata $f
done

for f in ncharts/fixtures/datasets_*.json; do
    ff=${f##*/}
    echo $ff
    python3 manage.py loaddata $ff
done

echo "running full_clean on Datasets"

python3 manage.py shell << EOD
from ncharts.models import Dataset, FileDataset
from django.core.exceptions import ValidationError

print("{0} datasets".format(len(FileDataset.objects.all())))

for d in FileDataset.objects.all():
    print("d.name=",d.name)
    try:
        d.full_clean()
    except ValidationError as e:
        print(e)
        exit(1)

exit(0)
EOD

if $prod; then
    :
    # sudo chown apache.apache /var/lib/django/db.sqlite3
    # sudo chmod 0755 /var/lib/django
    # sudo chmod 0600 /var/lib/django/db.sqlite3
fi
