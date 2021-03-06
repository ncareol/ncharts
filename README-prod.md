# ncharts

Data plotting Web application, developed at NCAR EOL.

## Setup and Starting a Production Server

The following is for RedHat systems, such as CentOS or Fedora.

1. Install required packages

  This is the same as step one in setting up a development server. See `README-devel.md`.

2. Decide where to put the django code and configuration.

  We'll call that `$DJROOT`.  Files for production server at EOL have been put on `/var/django`:

  ```sh
  export DJROOT=/var/django
  sudo mkdir $DJROOT
  sudo chgrp apache $DJROOT
  sudo chmod g+sw $DJROOT
```

  Add yourself to the apache group on the server machine.  Once you've done that, the sequence is the same as on a development server:

  ```sh
  cd $DJROOT
  git clone https://github.com/ncareol/ncharts.git
  cd ncharts
```

3. Create virtual environment

  A virtual environment allows you to run specific versions of python packages without effecting other users on the system.  These commands will create a django virtual environment in `$DJROOT`:

  ```sh
  cd $DJROOT
  mkdir virtualenv
  cd virtualenv
  virtualenv -p /usr/bin/python3 django

  DJVIRT=$DJROOT/virtualenv/django
  source $DJVIRT/bin/activate
```

4. Add other Python packages to virtual environment:

  ```sh
  source $DJVIRT/bin/activate

  python3 -m pip install --upgrade django
  python3 -m pip install --upgrade mod_wsgi
  python3 -m pip install --upgrade numpy
  python3 -m pip install --upgrade pytz
  python3 -m pip install --upgrade netCDF4
  python3 -m pip install --upgrade pylint_django
  python3 -m pip install --upgrade psycopg2

  python3 -m pip install django-datetime-widget
  python3 -m pip install django-timezone-field

  python3 -m pip install python3-memcached
```

  On RHEL:
  ```sh
  sudo mod_wsgi-express install-module
  sudo sh -c "cat > /etc/httpd/conf.modules.d/10-wsgi-python3.conf"
# NOTE: mod_wsgi_python3 can not coexist in the same apache process as
# mod_wsgi (python2).  Only load if mod_wsgi is not already loaded.

<IfModule !wsgi_module>
    LoadModule wsgi_module modules/mod_wsgi-py34.cpython-34m.so
</IfModule>
```

5. Setup postgres server
  This is the same as step 5 in setting up a development server. See `README-devel.md`.

6. Configuration

  Production settings are set and managed in `datavis/settings/production.py`. `DEBUG` should be set to `False`, as the Django docs warn in several places that using `DEBUG = True` on a production server exposed to the WWW is a security hole.

  Create and set permissions on `LOG_DIR`, `VAR_RUN_DIR` and `VAR_LIB_DIR`, per their values set in `datavis/settings/production.py`:

  ```sh
  sudo mkdir /var/log/django
  sudo chgrp apache /var/log/django
  sudo chmod g+sw /var/log/django

  sudo mkdir /var/run/django
  sudo chgrp apache /var/run/django
  sudo chmod g+sw /var/run/django

  sudo mkdir /var/lib/django
  sudo chgrp apache /var/lib/django
  sudo chmod g+sw /var/lib/django
  ```

  Configure the DATABASES in `datavis/settings/default.py` as discussed in `README-devel.md`.

7. Create the key
  A Django `SECRET_KEY` must be assigned via the `EOL_DATAVIS_SECRET_KEY` environment variable. To generate a new `SECRET_KEY`:

  ```sh
  key=$(python3 -c 'import random; import string; print("".join([random.SystemRandom().choice(string.digits + string.ascii_letters + string.punctuation) for i in range(100)]))')
  export EOL_DATAVIS_SECRET_KEY=$key
```
The key can be passed to Apache from `systemd` by adding a `.conf` service file to `/etc/systemd/system/httpd.service.d/`, *e.g.* `datavis-secret-key.conf`:

  ```
[Service]
Environment="EOL_DATAVIS_SECRET_KEY=abc-123-CHANGE-ME"
```
  After updating the `.conf` service file, `systemd` will need to have its daemon reloaded and **Apache** will need to be restarted:

  ```sh
  sudo systemctl daemon-reload
  sudo systemctl restart httpd
```
8. Initialize the database

  This also runs the django migration command, which should also handle the situation when one of the models changes, or is added or deleted:

  ```sh
  cd $DJROOT/ncharts
  ./create_pgdb.sh
  ./load_db.sh
```

  If the database has not been created yet, you will be prompted to enter an administrator's user name, email and password. You can use your own user name and email address. If the server will be exposed to the internet, you should enter a secure password, which should not match other passwords.

  Migrations in django are a bit complicated. If the above script fails you may have to reset the migration history for ncharts:

  ```sh
  ./delete_pgdb.sh
  rm -rf ncharts/migrations
```

  Then run the create script again.

9. Load the models from the `.json` files in `ncharts/fixtures`:

  ```sh
  ./load_db.sh
```

10. Fetch the static files

  To fetch the static files of the supporting software used by ncharts, such as jquery, bootstrap and highcharts do:

  ```sh
  ./get_static_files.sh
```

  The files will be written to `$DJROOT/ncharts/static/ncharts`.

  Then on a production server, execute the static.sh shell script:

  ```sh
  ./static.sh
```

  This shell script executes the django *collectstatic* command to find the static files in the ncharts directory, as well as static files in python site-packages, and copies them to BASE_DIR/static.

  On a production server, the root files go in BASE_DIR/static, which is the same as $DJROOT/static. `See datavis/settings/default.py`:

  ```python
  STATIC_ROOT = os.path.join(BASE_DIR,'static')
```

  On a production server, `static.sh` must be run every time `ncharts/static/ncharts/jslib/ncharts.js` is changed on the server.

  To see what static files are needed for ncharts, see the `<script>` tags in `ncharts/templates/ncharts/base.html`.

11. Memcached:

  The memory caching in django has been configured to use the memcached daemon, and a unix socket. The location of the unix socket is specified as `CACHES['LOCATION']` in `datavis/settings/production.py`:

  ```python
  'LOCATION': 'unix:' + os.path.join(VAR_RUN_DIR,'django_memcached.sock'),
```

  See above for creating and setting permissions on `VAR_RUN_DIR`.  To setup memcached, do:

  ```sh
  # Configure system to create /var/run/django on each boot
  sudo cp usr/lib/tmpfiles.d/django.conf /usr/lib/tmpfiles.d
  systemd-tmpfiles --create /usr/lib/tmpfiles.d/django.conf

  sudo cp etc/systemd/system/memcached_django.service /etc/systemd/system
  sudo systemctl daemon.reload
  sudo systemctl enable memcached_django.service
  sudo systemctl start memcached_django.service
```

12. Configure and start httpd server

  Install the httpd configuration files:

  ```sh
  sudo mv /etc/httpd /etc/httpd.orig
  sudo cp -r etc/datavis/httpd /etc
```

  The httpd configuration file that sets up the wsgi python module for django is `etc/datavis/httpd/conf/vhosts/datavis.conf`, which is installed to `/etc/httpd/conf/vhosts`. The `WSGIScriptAlias` statement in this file tells httpd to run `/var/django/ncharts/datavis/wsgi.py` for all URLs. In this way a production server runs `wsgi.py` instead of `manage.py`, with `DJANGO_SETTINGS_MODULE` set to `datavis.settings.production`.  For information on wsgi, see the django documentation for the current version, for example: `https://docs.djangoproject.com/en/1.11/howto/deployment/wsgi/`.

  Tweak the umask of the systemd service, so that apache group members can read/write the log files:

  ```sh
  sudo mkdir /etc/systemd/system/httpd.service.d
  cat << EOD > /tmp/umask.conf
  [Service]
  UMask=0007
  EOD

  sudo cp /tmp/umask.conf /etc/systemd/system/httpd.service.d
  sudo systemctl daemon-reload
```

  See above for creating and setting permissions on `LOG_DIR`.

  Enable and start httpd:

  ```sh
  sudo systemctl enable httpd.service
  sudo systemctl start httpd.service
```

13. Test!

   <http://localhost/ncharts>

14. Clearing expired sessions and unattached ClientState objects

  This is done from a crontab on the server:

  ```sh
  crontab -l
  MAILTO=user@some.domain       # change to a real email address
  #
  # On Sundays, clear expired sessions and then the unattached clients
  0 0 * * 0 cd /var/django/ncharts; ./datavis-clear.sh
```
