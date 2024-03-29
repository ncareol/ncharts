from django import template
from ncharts import models as nc_models
import datetime

register = template.Library()

@register.filter
def get_long_name(vs, v):
    """Get 'long_name' value of vs[v] """
    try:
        return vs[v]['long_name']
    except:
        return ''

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key)

@register.filter
def get_key_values(var_name, variables):
    for var in variables:
        if var.choice_label == var_name:
            return var

@register.filter
def make_tabs(variables, dset):
    return dset.make_tabs(variables)

@register.filter
def get_site_names(dset):
    return sorted(dset.get_sites().keys())

@register.filter
def get_station_names(dset):
    return dset.get_station_names()

@register.filter
def get_end_time_string(dset):
    et = dset.get_end_time()
    if et > datetime.datetime.now(tz=datetime.timezone.utc):
        return "Ongoing"
    return et

@register.filter
def make_project_tabs(projects):
    """Get the dictionary of years and projects from models.py"""
    return nc_models.Project.make_tabs(projects)

@register.filter
def get_lev1tab_tooltip(site, dset):
    if site == "stations":
        return "Variables common to numbered stations"
    else:
        site_ln = ''
        if site in dset.get_sites():
            site_ln = dset.get_sites()[site]
        else:
            site_ln = ''
        if site_ln:
            return "Variables of site " + site + ", " + site_ln
        return "Variables of site " + site
