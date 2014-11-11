from ncharts.models import Root, Project, Platform, Dataset, UserSelection, Variable
# from ncharts.forms import UserSelectionForm

from pytz import timezone, utc
from datetime import datetime, timedelta

mttz = timezone("US/Mountain")
aztz = timezone("US/Arizona")

projroot = Root.objects.create(name='projects')
platroot = Root.objects.create(name='platforms')

proj = Project.objects.create(name='Weather', projects=projroot)

wx = Platform.objects.create(name='Weather Station',platforms=platroot)

dset = Dataset.objects.create(name='flab-5min',
    location='NCAR Foothills Lab, Boulder CO',
    timezone='US/Mountain',
    directory='/home/maclean/www/weather/flab/data',
    filenames='flab.%Y%m%d.cdf',
    start_time = mttz.localize(datetime(2009,1,1,0,0,0),is_dst=True),
    end_time = datetime.now(mttz),
    project=proj)

# for v in ['tdry','rh','pres','cpres0','dp','wdir','wspd','wmax','wchill','raina','raina24']:
#     var = Variable.objects.create(name=v)
#     dset.variables.add(var)

dset.add_platform(wx)
# dset.platforms.add(wx)
# dset.project.platforms.add(wx)
# dset.save()

dset = Dataset.objects.create(name='nwsc-5min',
    location='NCAR Wyoming Supercomputer Center, Cheyenne WY',
    timezone='US/Mountain',
    directory='/home/maclean/www/weather/nwsc/data',
    filenames='nwsc.%Y%m%d.cdf',
    start_time = mttz.localize(datetime(2009,1,1,0,0,0),is_dst=True),
    end_time = datetime.now(mttz),
    project=proj)

for v in ['tdry','rh','pres','cpres0','dp','wdir','wspd','wmax','wchill','raina','raina24']:
    var = Variable.objects.create(name=v)
    dset.variables.add(var)

dset.add_platform(wx)
# dset.platforms.add(wx)
# dset.project.platforms.add(wx)
# dset.save()

dset = Dataset.objects.create(name='nwsc-10min',
    location='NCAR Wyoming Supercomputer Center, Cheyenne WY',
    timezone='US/Mountain',
    directory='/home/maclean/www/weather/nwsc10/data',
    filenames='nwsc.%Y%m%d.cdf',
    start_time = mttz.localize(datetime(2009,1,1,0,0,0),is_dst=True),
    end_time = datetime.now(mttz),
    project=proj)

for v in ['tdry','rh','pres','cpres0','dp','wdir','wspd','wmax','wchill','raina','raina24']:
    var = Variable.objects.create(name=v)
    dset.variables.add(var)

dset.add_platform(wx)
# dset.platforms.add(wx)
# dset.project.platforms.add(wx)
# dset.save()

proj = Project.objects.create(name='METCRAXII', projects=projroot)

isfs = Platform.objects.create(name='ISFS',platforms=platroot)

tz = timezone("US/Arizona")

dset = Dataset.objects.create(name='5min',
    location='Meteor Crater',
    timezone='US/Arizona',
    directory='/home/maclean/isfs/projects/METCRAXII/netcdf',
    filenames='isfs_%Y%m%d.nc',
    start_time = aztz.localize(datetime(2013,9,27,0,0,0),is_dst=True),
    end_time = aztz.localize(datetime(2013,11,2,0,0,0),is_dst=True),
    project=proj)
dset.add_platform(isfs)
# dset.platforms.add(isfs)
# dset.project.platforms.add(isfs)
# dset.save()

dset = Dataset.objects.create(name='hr',
    location='Meteor Crater',
    timezone='US/Arizona',
    directory='/home/maclean/isfs/projects/METCRAXII/netcdf_hr',
    filenames='isfs_%Y%m%d.nc',
    start_time = aztz.localize(datetime(2013,9,27,0,0,0),is_dst=True),
    end_time = aztz.localize(datetime(2013,11,2,0,0,0),is_dst=True),
    project=proj)

for v in ['tdry','rh','pres','cpres0','dp','wdir','wspd','wmax','wchill','raina','raina24']:
    var = Variable.objects.create(name=v)
    dset.variables.add(var)

dset.add_platform(isfs)
# dset.platforms.add(isfs)
# dset.project.platforms.add(isfs)
# dset.save()

'''
usersel = UserSelection.objects.create(
    dataset = dset,
    start_time = datetime(2013,9,27,0,0,0,tzinfo=utc),
    end_time = datetime.now(utc),
    # variables = 'tdry, rh, pres, cpres0, dp, wdir, wspd, wmax, wchill, raina, raina24'
    )

tdry = SelectedVariable.objects.create(name='tdry',selected=False)

usersel.variables.add(tdry)

# f = UserSelectionForm(instance=usersel)

'''
