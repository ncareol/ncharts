
// See gregfranko.com/blog/jquery-best-practices
//
// IIFE: Immediately Invoked Function Expression
(function(main_iife_function) {
    main_iife_function(window.jQuery, window, document);
}(function($,window,document) {

    // Put local variables and functions into this namespace
    local_ns = {};

    local_ns.debug_level = 0;

    local_ns.colorAxisRecomputeEvery = 10;
    local_ns.colorAxisRecomputeCntr = 0;

    local_ns.find_x_ge = function(arr,val) {
        var index = null;
        arr.some(function(e1,i) {
            return e1['x'] >= val ? (( index = i), true) : false;
        });
        return index;
    };

    local_ns.unique = function(arr) {
        return arr.filter(function(value, index, array) {
            return array.indexOf(value) === index;
        });
    };

    local_ns.setPlotTimezone = function(val) {
        // console.log("calling Highcharts.setOptions,val",val);
        local_ns.plotTimezone = val;
        local_ns.zone = moment.tz.zone(val);
        Highcharts.setOptions({
            global: {
                getTimezoneOffset: function(timestamp) {
                    var timezoneOffset =
                        -moment.tz(timestamp,local_ns.plotTimezone).utcOffset();
                    // console.log("timezoneOffset=",timezoneOffset);
                    return timezoneOffset;
                },
                // Documentation on this seems wrong. With the current
                // logic here, we must set this to true.
                useUTC: true,
            }
        });
    };
    local_ns.format_time = function(val, format) {
        format = typeof format !== "undefined" ? format : 'YYYY-MM-DD HH:mm:ss ZZ';
        var mom = moment(val).tz(local_ns.pickerTimezone);
        // format it, and set it on the picker
        return mom.format(format);
    };

    local_ns.update_start_time = function(start_time) {
        var dstr = local_ns.format_time(start_time,'YYYY-MM-DD HH:mm');
        // console.log("updating start_time, dstr=",dstr);
        $("input#id_start_time").val(dstr);
        local_ns.update_sounding_boxes(start_time);
    };

    local_ns.last_scroll = Date.now() - 60 * 1000;
    local_ns.scroll = function(offset) {
        var now = Date.now();
        // Don't scroll more often than 30 seconds
        if (now > local_ns.last_scroll + 30 * 1000) {
            $('html,body').animate({scrollTop: offset},1000);
            local_ns.last_scroll = now;
        }
    };

    local_ns.update_sounding_boxes = function(start_time) {

        try {
            // console.log("update_sounding_boxes, soundings.length=",soundings.length);
            if (soundings.length > 0) {
                var checked_list = [];
                $("input[id^='id_soundings']").each(function(index) {
                    // console.log("this=",this);
                    if ($(this).prop("checked")) {
                        // console.log("this=",this," is checked");
                        checked_list.push($(this).attr("value"));
                    }
                });
                var $scb = $("#sounding-checkbox");
                $scb.empty();

                // console.log("checked_list=",checked_list);
                var icb = 0;
                for (var is = 0; is < soundings.length; is++) {
                    var sname = soundings[is][0];
                    var stime = soundings[is][1] * 1000;	// milliseconds
                    var checked = checked_list.indexOf(sname) > -1;
                    // console.log("sname=",sname,", checked=",checked);
                    if (stime >= start_time && stime < start_time + local_ns.time_length) {
                        var $cb = $("<input name='soundings' type='checkbox'/>")
                            .attr("id", "id_soundings_" + icb)
                            .attr("value", sname)
                            .prop("checked", checked);
                        var $label = $("<label>");
                        $label.append(sname);
                        $label.append($cb);
                        $label.append('&nbsp;&nbsp;');
                        $scb.append($label);
                        icb++;
                    }
                }
            }
        }
        catch (err) {
            return;
        }
    };

    local_ns.get_start_time = function() {
        var dstr = $("input#id_start_time").val();
        return moment.tz(dstr,'YYYY-MM-DD HH:mm',local_ns.pickerTimezone);
    };

    // set the value of local_ns.time_length in units of milliseconds
    local_ns.update_time_length = function(time_length,time_length_units,update) {

        switch(time_length_units) {
        case "day":
            time_length *= 24;
        case "hour":
            time_length *= 60;
        case "minute":
            time_length *= 60;
        case "second":
            time_length *= 1000;    // milliseconds
            break;
        }
        local_ns.time_length = time_length;

        if (local_ns.track_real_time) {
            local_ns.update_start_time(Date.now() - local_ns.time_length);
        }

        if (update) {
            local_ns.update_sounding_boxes(local_ns.get_start_time());
        }
    };

    // Add support for %Z time formatter
    Highcharts.dateFormats = {
        Z: function (timestamp) {
            // console.log("zone.abbr=",local_ns.zone.abbr(timestamp));
            return local_ns.zone.abbr(timestamp);
        },
    };

    local_ns.do_ajax = function() {
        // console.log("do_ajax");
        $.ajax({
            url: ajaxurl,
            timeout: 30 * 1000,
            // Seems that android chrome is not sending out ajax requests.
            // Web post indicates setting cache: false may help.
            cache: false,
            // No data is sent to the server. In the ajax url is a numeric id which
            // is used to map to the user's selection.
            dataType: "json",   // type of data back from server

            error: function(jqXHR, error_type, errorThrown) {
                /*
                 * From http://api.jquery.com/jquery.ajax/:
                 * Possible values for the second argument (besides null) are
                 * "timeout", "error", "abort", and "parsererror".
                 * When an HTTP error occurs, errorThrown receives the textual
                 * portion of the HTTP status, such as "Not Found" or "Internal Server Error." 
                 */
                /* TODO: make this an alert, when sure it is very rare */
                console.log("ajax error_type=",error_type);
                console.log("ajax errorThrown=",errorThrown);
                // schedule again
                setTimeout(local_ns.do_ajax,local_ns.ajaxTimeout);
            },
            success: function(ajaxin) {

                if (ajaxin.redirect) {
                    alert("AJAX request failed: " + ajaxin.message);
                    window.location.replace(ajaxin.redirect);
                }

                // console.log("ajax success!, now=",new Date(),",
                // itime0=",itime0);
                var first_time = null;  // first plotted time

                $("div[id^='time-series']").each(function(index) {

                    // update time series plots from ajax data
                    var chart = $( this ).highcharts();

                    for (var var_index = 0; var_index < ajaxin.data.length; var_index++) {
                        var var_data = ajaxin.data[var_index];
                        var itimes = $.parseJSON(var_data.time);
                        if (itimes.length === 0) {
                            continue;
                        }
                        var itime0 = var_data.time0;
                        var vdata = $.parseJSON(var_data.data);

                        var stn_names = var_data.stations;

                        for (var stn_index = 0; stn_index < stn_names.length; stn_index++) {

                            var plotvname = var_data.variable;
                            var stn_name = stn_names[stn_index];
                            if (stn_name.length > 0) {
                                plotvname += ' ' + stn_name;
                            }

                            var series_index;
                            for (series_index = 0; series_index < chart.series.length; series_index++ ) {
                                var vname = chart.series[series_index].name;
                                if (vname == 'Navigator') continue;
                                if (vname == plotvname) break;
                            }
                            if (series_index == chart.series.length) continue;

                            var series = chart.series[series_index];

                            if (series.data.length > 0) {
                                first_time = series.data[0].x;
                            }

                            /*
                            console.log("var_index=",var_index,", plotvname=",plotvname,
                                    ", itimes.length=",itimes.length,
                                    ", vdata.length=",vdata.length,
                                    ", series.data.length=",series.data.length)
                            */

                            // shouldn't often happen in this ajax function
                            if (series.data.length === 0 && local_ns.debug_level) {
                                console.log("ajax, series_index=",series_index,", vname=",vname,
                                        ", series.data.length=",series.data.length);
                            }

                            // console.log("first_time=",local_ns.format_time(first_time));

                            /*
                            console.log("var_index=",var_index,", vname=",vname,
                                    ",ajaxin.data[var_index].variable=",
                                    ajaxin.data[var_index].variable,
                                    ", vdata.length=",vdata.length)
                            */

                            var ix = 0;
                            var tx;
                            for (var idata = 0; idata < itimes.length; idata++) {
                                var redraw = (idata == itimes.length - 1 ? true : false);
                                tx = (itime0 + itimes[idata]) * 1000;

                                var dx = vdata[idata];
                                if (dx !== null && dx.length > stn_index) dx = dx[stn_index];

                                // var dl = series.data.length; 
                                for ( ; ix < series.data.length; ix++) {
                                    try {
                                        if (series.data[ix].x >= tx) break;
                                    }
                                    catch(err) {
                                        console.log("error ",err," in looping over chart times, ",
                                                "var=",vname,
                                                ", data time=",
                                                local_ns.format_time(tx),
                                                ", ix=", ix, ", len=",
                                                series.data.length);
                                    }
                                }

                                // later time than all in chart, add with possible shift
                                if (ix == series.data.length) {
                                    var shift = (first_time !== null &&
                                            (tx > first_time + local_ns.time_length));

                                    series.addPoint([tx,dx],redraw,shift);
                                    if (shift && series.data.length) {
                                        try {
                                            // Even though a point was just added, series.data.length
                                            // may be 0 here, and you'll get this exception when
                                            // accessing series.data[0].x:
                                            // "TypeError: Cannot read property 'x' of undefined"
                                            // It appears that series.data is cached somehow
                                            // Add the above check for series.data.length to
                                            // avoid this error
                                            first_time = series.data[0].x;
                                        }
                                        catch(err) {
                                            var first_time_str = "null";
                                            if (first_time !== null) {
                                                first_time_str = local_ns.format_time(first_time);
                                            }
                                            console.log("error ",err," in accessing first chart time, ",
                                                    "var=",vname,", series_index=", series_index,
                                                    ", tx=",
                                                    local_ns.format_time(tx),
                                                    ", first_time=", first_time_str,
                                                    ", idata=",idata,", ix=", ix, ", len=",
                                                    series.data.length);
                                        }
                                        if (ix) ix--;
                                    }
                                }
                                else {
                                    var ctx = 0;
                                    if (ix < series.data.length) ctx = series.data[ix].x;
                                    if (ctx == tx) {    // same time, replace it
                                        series.data[ix].update(dx,redraw);
                                    }
                                    else {
                                        // shift=false, adding in middle
                                        if (local_ns.debug_level > 1) {
                                            console.log("var=",vname,
                                                    " insert time, tx=",
                                                    local_ns.format_time(tx),
                                                    ", ctx=",
                                                    local_ns.format_time(ctx),
                                                    ", ix=", ix, ", len=",
                                                    series.data.length); 
                                        }
                                        series.addPoint([tx,dx],redraw,false);
                                    }
                                }
                            }

                            var npts = 0;
                            while ((l = series.data.length) > 1 &&
                                    series.data[l-1].x >
                                    series.data[0].x + local_ns.time_length) {
                                        series.removePoint(0,true);
                                        first_time = series.data[0].x;
                                        npts++;
                                    }
                            if (npts && local_ns.debug_level) {
                                console.log("var=",vname," removed ",npts," points, time_length=",
                                        local_ns.time_length);
                            }
                            if (local_ns.debug_level) {
                                console.log("time-series ajax function done, var= ",vname,
                                        ", itimes.length=",itimes.length,
                                        ", first_time=", local_ns.format_time(first_time),
                                        ", chart.series[",series_index,"].data.length=", series.data.length);
                            }
                            // Update time axis title on LHS of plot
                            if (first_time !== null) {
                                chart.xAxis[0].setTitle({
                                    text: local_ns.format_time(first_time,
                                        "YYYY-MM-DD HH:mm ZZ") +
                                        " (" + local_ns.plotTimezone + ")"});
                            }
                        }   // station index
                    }   // input ajax variable indec

                    // charts of multiple variables sometimes take a while to redraw
                    // if (chart.series.length > 1) chart.redraw();

                });

                $("div[id^='heatmap']").each(function(index) {

                    // update heatmap plots from ajax data
                    var chart = $( this ).highcharts();

                    var extr =  chart.colorAxis[0].getExtremes();

                    var cminval;
                    var cmaxval;
                    // on the first ajax callback, this seems to be undefined
                    if (extr.dataMin === undefined) {
                        cminval = chart.colorAxis[0].min;
                        cmaxval = chart.colorAxis[0].max;
                    } else {
                        cminval = extr.dataMin;
                        cmaxval = extr.dataMax;
                    }
                    if (local_ns.debug_level) {
                        console.log("heatmap, colorAxis dataMin=",cminval,
                            ", dataMax=",cmaxval);
                    }
                    var minval = cminval;
                    var maxval = cmaxval;
                    var resetColorAxis = false;

                    var t0 = new Date();
                    var t1;
                    for (var iv = 0; iv < chart.series.length; iv++ ) {
                        var series = chart.series[iv];
                        var vname = series.name;
                        //console.log("vname=",vname)

                        if (series.data.length > 0) {
                            first_time = series.data[0].x;
                        }

                        var var_index;
                        for (var_index = 0; var_index < ajaxin.data.length; var_index++) {
                            if (ajaxin.data[var_index].variable == vname) { break; }
                        }

                        if (var_index == ajaxin.data.length) continue;

                        var var_data = ajaxin.data[var_index];

                        var itimes = $.parseJSON(var_data.time);

                        if (itimes.length === 0) {
                            continue;
                        }

                        var itime0 = var_data.time0;
                        var vdata = $.parseJSON(var_data.data);
                        var dim2 = $.parseJSON(var_data.dim2);

                        if (local_ns.debug_level > 1) {
                            t0 = new Date();
                            console.log("heatmap ",t0,", vname=",vname,", adding ",itimes.length,
                                    " points, dim2.length=",dim2.length);
                        }

                        var ix = 0;
                        var tx;

                        // redraw == true results in very slow performance on heatmaps.
                        // Instead we wait and do a chart.redraw() when all points have
                        // been updated.
                        var redraw = false;

                        for (var idata = 0; idata < itimes.length; idata++) {
                            // redraw = (idata == itimes.length - 1 ? true : false);

                            tx = (itime0 + itimes[idata]) * 1000;

                            for ( ; ix < series.data.length; ix++) {
                                if (series.data[ix].x >= tx) break;
                            }

                            // later time than all in chart, add with possible shift
                            if (ix == series.data.length) {
                                // shift=true is slow on a heatmap. Disable it.
                                var shift = false;
                                for (var j = 0; j < dim2.length; j++) {
                                    dx = vdata[idata][j];
                                    if (dx !== null) {
                                        if (dx > maxval) {
                                            resetColorAxis = true;
                                            maxval = dx;
                                        }
                                        else if (dx < minval) {
                                            resetColorAxis = true;
                                            minval = dx;
                                        }
                                    }
                                    // console.log("heatmap addPoint, idata=",idata,
                                    //         ", iv=",iv,", j=",j," length=",series.data.length);
                                    series.addPoint(
                                            [tx,dim2[j],dx], redraw,shift);
                                }
                                if (shift || first_time === null) {
                                    first_time = series.data[0].x;
                                    ix -= dim2.length;
                                }
                            }
                            else {
                                var ctx = series.data[ix].x;
                                if (ctx == tx) {    // same time, replace it
                                    for (var j = 0; j < dim2.length; j++) {
                                        dx = vdata[idata][j];
                                        if (dx !== null) {
                                            if (dx > maxval) {
                                                resetColorAxis = true;
                                                maxval = dx;
                                            }
                                            else if (dx < minval) {
                                                resetColorAxis = true;
                                                minval = dx;
                                            }
                                        }
                                        series.data[ix+j].update([tx,dim2[j],dx],redraw);
                                    }
                                }
                                else {
                                    // shift=false, adding in middle
                                    for (var j = 0; j < dim2.length; j++) {
                                        dx = vdata[idata][j];
                                        if (dx !== null) {
                                            if (dx > maxval) {
                                                resetColorAxis = true;
                                                maxval = dx;
                                            }
                                            else if (dx < minval) {
                                                resetColorAxis = true;
                                                minval = dx;
                                            }
                                        }
                                        // console.log("heatmap addPoint, idata=",idata,
                                        //         ", iv=",iv,", j=",j," length=",series.data.length);
                                        series.addPoint(
                                                [tx,dim2[j],dx], redraw,false);
                                    }
                                    if (ctx > tx && ix === 0) {
                                        first_time = series.data[0].x;
                                    }
                                }
                            }
                        }
                        if (local_ns.debug_level > 1) {
                            t1 = new Date();
                            console.log("added ", itimes.length, " points, elapsed time=",(t1 - t0)/1000," seconds");
                            t0 = t1;
                        }
                        // remove points
                        var npts = 0;
                        while ((l = series.data.length) > 1 &&
                                series.data[l-1].x >
                                series.data[0].x + local_ns.time_length) {

                                    dx = series.data[0].value;
                                    series.removePoint(0,redraw);
                                    first_time = series.data[0].x;
                                    if (!local_ns.colorAxisRecomputeCntr && dx !== null &&
                                            (dx == cminval || dx == cmaxval)) {
                                                // schedule a recompute of the colorAxis
                                                local_ns.colorAxisRecomputeCntr =
                                                    local_ns.colorAxisRecomputeEvery;
                                            }
                                    npts++;
                                }
                        if (local_ns.debug_level > 1) {
                            t1 = new Date();
                            console.log("removed ", npts, " points, elapsed time=",(t1 - t0)/1000," seconds");
                            t0 = t1;
                        }
                        if (local_ns.debug_level) {
                            console.log("heatmap ajax function done, var= ",vname,
                                    ", itimes.length=",itimes.length,
                                    ", first_time=", local_ns.format_time(first_time),
                                    ", chart.series[",iv,"].data.length=", series.data.length);
                        }
                        // Update time axis title on LHS of plot
                        if (first_time !== null) {
                            chart.xAxis[0].setTitle({
                                text: local_ns.format_time(first_time,
                                    "YYYY-MM-DD HH:mm ZZ") +
                                    " (" + local_ns.plotTimezone + ")"});
                        }
                    }
                    if (local_ns.colorAxisRecomputeCntr > 0) {
                        if (local_ns.debug_level) {
                            console.log("colorAxisRecomputeCntr=",
                                    local_ns.colorAxisRecomputeCntr);
                        }
                        local_ns.colorAxisRecomputeCntr--;
                        if (!local_ns.colorAxisRecomputeCntr) {
                            resetColorAxis = true;
                            minval = Number.POSITIVE_INFINITY;
                            maxval = Number.NEGATIVE_INFINITY;
                            for (ix = 0 ; ix < series.data.length; ix++) {
                                dx = series.data[ix].value;
                                if (dx !== null) {
                                    minval = Math.min(minval,dx);
                                    maxval = Math.max(maxval,dx);
                                }
                            }
                            if (local_ns.debug_level)
                                console.log("new minval=",minval,", maxval=",maxval);
                        }
                    }

                    if (resetColorAxis) {
                        if (local_ns.debug_level)
                            console.log("resetColorAxis, minval=",minval,", maxval=",maxval);
                        chart.colorAxis[0].update({
                            min: minval,
                            max: maxval,
                        },true);
                    }
                    chart.redraw();
                    if (local_ns.debug_level > 1) {
                        t1 = new Date();
                        console.log("chart redraw, elapsed time=",(t1 - t0)/1000," seconds");
                        t0 = t1;
                    }
                });

                // update the start time on the datetimepicker from
                // first time in chart (milliseconds)
                if (first_time !== null) {
                    local_ns.update_start_time(first_time);
                }

                var current_top = document.documentElement.scrollTop || document.body.scrollTop;
                var plot_top = $("#plot_button").offset().top;
                if (current_top < plot_top) {			  
                    local_ns.scroll(plot_top);
                }

                // schedule again
                setTimeout(local_ns.do_ajax,local_ns.ajaxTimeout);
            }
        });
    };

    $(function() {

        if (local_ns.debug_level) {
            console.log("DOM is ready!");
        }

        // When doc is ready, grab the selected time zone
        var tzelem = $("select#id_timezone");
        var tz = tzelem.val();
        local_ns.pickerTimezone = tz;
        local_ns.setPlotTimezone(tz);

        local_ns.long_name_dict = {};

        // console.log("select#id_timezone tz=",tz)

        $("select#id_timezone").change(function() {
            // When user changes the timezone, adjust the time
            // in the datetimepicker so that it is the
            // same moment in time as with the previous timezone.
            //
            // Unfortunately datetimepicker time formats
            // are different than moment time formats:
            // datetimepicker:  "yyyy-mm-dd hh:ii"
            // moment:          "YYYY-MM-DD HH:mm"
            // The moment format is hard-coded here, and so
            // if the datetimepicker format is changed in
            // django/python, it must be changed here.
            //
            // Also couldn't find out how to get the current
            // datetimepicker format.
            //
            // To avoid formatting times one would get/set
            // from datetimepicker using javascript Date objects.
            // However, a javascript Date is either in the
            // browser's time zone or UTC. I believe there would
            // always be a problem right around the time of
            // daylight savings switches, if Date is used.

            // Note that we don't change the value of
            // the timezone in local_ns, since that must match
            // what is plotted.

            var picker = $("input#id_start_time");
            var dstr = picker.val();

            // console.log("picker.val()=",dstr);

            // parse time using current timezone
            var mom = moment.tz(dstr,'YYYY-MM-DD HH:mm',local_ns.pickerTimezone);

            // get the new timezone
            var new_tz = $(this).val();

            // save previous value, but don't
            local_ns.pickerTimezone = new_tz;

            // adjust time for new timezone
            mom = mom.tz(new_tz);

            // format it, and set it on the picker
            dstr = mom.format('YYYY-MM-DD HH:mm');
            picker.val(dstr);
        });

        $("#id_stations_clear").change(function() {
            // console.log("id_stations_clear change, val=",$(this).prop("checked"));
            if ($(this).prop("checked")) {
                $('#station-checkbox :checked').prop('checked',false);
                $(this).prop('checked',false);
            }
        });

        $("#id_stations_all").change(function() {
            // console.log("id_stations_all change, val=",$(this).prop("checked"));
            if ($(this).prop("checked")) {
                $('#station-checkbox :not(:checked)').prop('checked',true);
                $(this).prop('checked',false);
            }
        });

        $("#id_variables_clear").change(function() {
            // console.log("id_variables_clear change, val=",$(this).prop("checked"));
            if ($(this).prop("checked")) {
                $('#all-variable-checkboxes :checked').prop('checked',false);
                $(this).prop('checked',false);
            }
        });

        $("#id_variables_all").change(function() {
            // console.log("id_variables_all change, val=",$(this).prop("checked"));
            if ($(this).prop("checked")) {
                $('#all-variable-checkboxes :not(:checked)').prop('checked',true);
                $(this).prop('checked',false);
            }
        });

        $("#id_tab_clear").change(function() {
            if ($(this).prop("checked")) {
                /* If two levels of tabs, find tab-pane with both levels active,
                 * and clear its checkboxes
                 */
                $('.lev1tab.active .lev2tab.active #variable_list :checked').prop('checked',false); 
                /* If one level of tabs, find active level 2 tab-pane,
                 * and check its checkboxes
                 */
                $('.nolev1tab .lev2tab.active #variable_list :checked').prop('checked',false); 
                $(this).prop('checked',false);
            }
        });

        $("#id_tab_all").change(function() {
            if ($(this).prop("checked")) {
                /* If two levels of tabs, find tab-pane with both levels active,
                 * and check its checkboxes
                 */
                $('.lev1tab.active .lev2tab.active #variable_list :not(:checked)').prop('checked',true);
                /* If one level of tabs, find active level 2 tab-pane,
                 * and check its checkboxes
                 */
                $('.nolev1tab .lev2tab.active #variable_list :not(:checked)').prop('checked',true); 
                $(this).prop('checked',false);
            }
        });

        $("#soundings_clear").change(function() {
            if ($(this).prop("checked")) {
                $('#sounding-checkbox :checked').prop('checked',false);
                $(this).prop('checked',false);
            }
        });

        $("#soundings_all").change(function() {
            if ($(this).prop("checked")) {
                $('#sounding-checkbox :not(:checked)').prop('checked',true);
                $(this).prop('checked',false);
            }
        });

        $("ul.tabrow li").click(function(e) {
            e.preventDefault();
            $("li").removeClass("selected");
            $(this).addClass("selected");
        });

        // set the time_length

        local_ns.update_time_length(
                $("input#id_time_length_0").val(),
                $("select#id_time_length_units").val(),
                true);

        /* If the user wants to track real time with ajax. */
        local_ns.track_real_time = $("input#id_track_real_time").prop("checked");

        $("input#id_start_time").change(function() {
            var start_time = local_ns.get_start_time();
            local_ns.update_sounding_boxes(start_time);
        });

        $("input#id_track_real_time").change(function() {
            local_ns.track_real_time = $(this).prop("checked");
            if (local_ns.track_real_time) {
                local_ns.update_start_time(Date.now() - local_ns.time_length);
            }
        });

        // time_length text widget
        $("input#id_time_length_0").change(function() {
            var time_length = $(this).val();
            var time_length_units = $("select#id_time_length_units").val();
            local_ns.update_time_length(time_length,time_length_units,true);
        });

        // time_length select widget
        $("select#id_time_length_1").change(function() {
            var time_length = $(this).val();
            var time_length_units = $("select#id_time_length_units").val();
            $("input#id_time_length_0").val(time_length);
            local_ns.update_time_length(time_length,time_length_units,true);
        });

        // time_length units select widget
        $("select#id_time_length_units").change(function() {
            var time_length_units = $(this).val();
            var time_length = $("input#id_time_length_0").val();
            local_ns.update_time_length(time_length,time_length_units,true);
        });

        // console.log("track_real_time=",local_ns.track_real_time);
        // Everything below here depends on plot_times and plot_data
        // being passed.
        if (window.plot_times === undefined) return;

        var first_time = local_ns.get_start_time();

        // Plot time series
        var $plots = $("div[id^='time-series']");
        var nplots = $plots.length;

        var isMobile = false; 

        if ('ontouchstart' in window) {
            isMobile = true;
        }

        $plots.each(function(plotindex) {

            // series name
            var sname = $( this ).data("series");
            var vnames = $( this ).data("variables");
            var vunits = $( this ).data("units");
            var long_names = $( this ).data("long_names");

            // console.log("time-series, plot_times[''].length=",plot_times[''].length);
            // console.log("vnames=",vnames,", vunits=",vunits);

            // A yAxis for each unique unit
            var yAxis = [];

            // One plot for all variable with the same units.
            // This has already been organized by python, so
            // unique_units will have length 1 here.
            var unique_units = local_ns.unique(vunits);

            // create a yAxis
            for (var j = 0; j < unique_units.length; j++) {
                var unit = unique_units[j];
                ya = {
                    title: {
                        text: unit,
                    },
                    opposite: false,
                    // docs seem to indicate that the default for
                    // ordinal is true, but the default seems to be
                    // false. We'll set it to false to make sure
                    ordinal: false,
                };
                yAxis.push(ya);
            }

            var nav = {
                height: 25,
                margin: 5,
                enabled: true,
            };

            if (isMobile) {
                nav.enabled = false;
            }

            /*
             * array of objects, one for each input variable,
             * with these keys:
             *  name: variable name and units
             *  data: 2 column array, containing time, data values
             *  yAxis: index of the yaxis to use
             *  tooltip: how to display points.
             */
            var series = [];

            var ptitle;
            if (vnames.length > 1) {
                ptitle = vnames[0] + ", " + vnames[1] + "...";
            }
            else {
                ptitle = vnames[0];
            }
            var ser_time0 = plot_time0[sname];
            var ser_times = plot_times[sname];
            var ser_data = plot_data[sname];
            var ser_stn_names = plot_stns[sname];

            for (var iv = 0; iv < vnames.length; iv++ ) {
                var vname = vnames[iv];
                if (!(vname in plot_vmap[sname])) continue;
                var var_index = plot_vmap[sname][vname];
                var var_data = ser_data[var_index];

                var stn_names = [''];
                if (vname in ser_stn_names) {
                    stn_names = ser_stn_names[vname];
                }

                var vunit = vunits[iv];

                for (var stn_index = 0; stn_index < stn_names.length; stn_index++) {
                    var plotvname;

                    var stn_name = stn_names[stn_index];
                    if (stn_name.length > 0) {
                        plotvname = vname + ' ' + stn_name;
                    }
                    else {
                        plotvname = vname;
                    }

                    if (long_names.length > iv) {
                        local_ns.long_name_dict[plotvname] = long_names[iv];
                    }
                    else {
                        local_ns.long_name_dict[plotvname] = '';
                    }
            
                    var vseries = {};
                    var vdata = [];
                    var idata;
                    if (stn_name.length > 0) {
                        for (idata = 0; idata < ser_times.length; idata++) {
                            vdata.push([(ser_time0 + ser_times[idata])*1000,
                                    var_data[idata][stn_index]]);
                        }
                    }
                    else {
                        for (idata = 0; idata < ser_times.length; idata++) {
                            vdata.push([(ser_time0 + ser_times[idata])*1000,
                                    var_data[idata]]);
                        }
                    }
                    if (ser_times.length) {
                        first_time = (ser_time0 + ser_times[0]) * 1000;
                    }

                    vseries['data'] = vdata;
                    vseries['name'] = plotvname;
                    vseries['lineWidth'] = 1;
                    /*
                       vseries['tooltip'] = {
                       valuePrefix: long_names[iv] + ':',
                       },
                       */

                    // which axis does this one belong to? Will always be 0
                    vseries['yAxis'] = unique_units.indexOf(vunit);
                    series.push(vseries);
                    if (local_ns.debug_level > 1) {
                        console.log("initial, plotvname=",plotvname,", series[",iv,"].length=",
                                series[iv].data.length);
                    }
                }
            }

            /*
             * A StockChart seems to have bugs. The data array chart.series[i].data
             * does not seem to be dependably accessible from ajax code.
             * chart.series[i].data.length was often 0. 
             * So instead of highcharts('StockChart',{}) just do highcharts({}).
             * All the same functionality seems to be there
             */
            $( this ).highcharts({
                chart: {
                    borderWidth: 1,
                    type: 'line',
                    zoomType: 'xy',
                    panning: true,
                    panKey: 'shift',
                    spacing: [10, 10, 5, 5],    // top,right,bot,left
                },
                credits: {  // highcharts.com link
                    enabled: (plotindex == nplots-1),
                },
                plotOptions: {
                    series: {
                        dataGrouping: {
                            dateTimeLabelFormats: {
                                millisecond:
                                    ['%Y-%m-%d %H:%M:%S.%L %Z', '%Y-%m-%d %H:%M:%S.%L', '-%H:%M:%S.%L %Z'],
                                second:
                                    ['%Y-%m-%d %H:%M:%S %Z', '%Y-%m-%d %H:%M:%S', '-%H:%M:%S %Z'],
                                minute:
                                    ['%Y-%m-%d %H:%M %Z', '%Y-%m-%d %H:%M', '-%H:%M %Z'],
                                hour:
                                    ['%Y-%m-%d %H:%M %Z', '%Y-%m-%d %H:%M', '-%H:%M %Z'],
                                day:
                                    ['%Y-%m-%d %Z', '%Y-%m-%d', '-%m-%d %Z'],
                                week:
                                    ['Week from %Y-%m-%d', '%Y-%m-%d', '-%Y-%m-%d'],
                                month:
                                    ['%Y-%m', '%Y-%m', '-%Y-%m'],
                                year:
                                    ['%Y', '%Y', '-%Y'],
                            }
                        },
                        gapSize: 2,
                    },
                },
                xAxis: {
                    type: 'datetime',
                    // opted not to add %Z to these formats.
                    // The timezone is in the xAxis label, and in
                    // the tooltip popups.
                    dateTimeLabelFormats: {
                        millisecond: '%H:%M:%S.%L',
                        second: '%H:%M:%S',
                        minute: '%H:%M',
                        hour: '%H:%M',
                        day: '%Y<br/>%m-%d',
                        month: '%Y<br/>%m',
                        year: '%Y',
                    },
                    startOnTick: false,
                    endOnTick: false,
                    title: {
                        align: "low",
                        text: local_ns.format_time(first_time,
                                "YYYY-MM-DD HH:mm ZZ") +
                            " (" + local_ns.plotTimezone + ")",
                    },
                    ordinal: false,
                },
                yAxis: yAxis,
                series: series,
                legend: {
                    enabled: true,
                    margin: 0,
                    verticalAlign: 'top',
                    useHTML: true,
                    // floating: true,
                },
                rangeSelector: {
                    enabled: false,
                },
                scrollbar: {
                    enabled: false,
                },
                tooltip: {
                    shared: true,       // show all points in the tooltip
                    /* define a formatter function to prefix the long_name
                     * to the variable name in the tooltip. Adding a
                     * tooltip.valuePrefix to the series almost works,
                     * but it is placed before the value, in bold.
                     * Tried using point.series.symbol, but it is a string,
                     * such as "circle"
                     */
                    formatter: function() {
                        s = '<span style="font-size: 10px"><b>' + Highcharts.dateFormat('%Y-%m-%d %H:%M:%S.%L %Z',this.x) + '</b></span><br/>';
                        $.each(this.points, function(i, point) {
                            s += '<span style="color:' + point.series.color + '">\u25CF</span>' + local_ns.long_name_dict[point.series.name] + ',' + point.series.name + ': <b>' + point.y + '</b><br/>';
                        });
                        return s;
                    },
                    // If no formatter, use these settings.
                    /*
                    headerFormat: '<span style="font-size: 10px"><b>{point.key}</b></span><br/>',
                    pointFormat: '<span style="color:{series.color}">\u25CF</span> ' + ',{series.name}: <b>{point.y}</b><br/>',
                    xDateFormat: '%Y-%m-%d %H:%M:%S.%L %Z',
                    valueDecimals: 6,
                    */
                },
                navigator: nav,
                title: {
                    // disable title, legend is good enough
                    // May want to put dataset name in title at some point
                    text: '',
                    // text: ptitle,
                    // style: {"color": "black", "fontSize": "14px", "fontWeight": "bold", "text-decoration": "underline"},
                    style: {"color": "#333333", "fontSize": "14px"},
                    margin: 5,
                },
            });
        });

        $plots = $("div[id^='heatmap']");
        nplots = $plots.length;
        $plots.each(function(plotindex) {

            // one plot per variable, vnames will have length of 1

            var sname =  $( this ).data("series");
            var vnames =  $( this ).data("variables");
            var vunits =  $( this ).data("units");
            var long_names = $( this ).data("long_names");

            local_ns.colorAxisRecomputeCntr = 0;

            var ser_time0 = plot_time0[sname];
            var ser_times = plot_times[sname];
            var ser_data = plot_data[sname];
            var ser_dim2 = plot_dim2[sname];

            // console.log("vnames=",vnames);
            for (var iv = 0; iv < vnames.length; iv++) {
                var vname = vnames[iv];
                var var_index = plot_vmap[sname][vname];
                var var_data = ser_data[var_index];
                // console.log("vname=", vname);
                if (long_names.length > iv) {
                    long_name = long_names[iv];
                } else {
                    long_name = vname;
                }
                var units = vunits[iv];

                var minval = Number.POSITIVE_INFINITY;
                var maxval = Number.NEGATIVE_INFINITY;

                var mintime = (ser_time0 + ser_times[0]) * 1000;
                var maxtime = (ser_time0 + ser_times[ser_times.length-1]) * 1000;
                var dim2_name = ser_dim2[vname]['name'];
                var dim2_units = ser_dim2[vname]['units'];

                var mindim2 = ser_dim2[vname]['data'][0];
                var maxdim2 = ser_dim2[vname]['data'][ser_dim2[vname]['data'].length-1];

                var chart_data = [];
                for (var i = 0; i < ser_times.length; i++) {
                    var tx = (ser_time0 + ser_times[i]) * 1000;
                    for (var j = 0; j < ser_dim2[vname]['data'].length; j++) {
                        dx = var_data[i][j];
                        if (dx !== null) {
                            minval = Math.min(minval,dx);
                            maxval = Math.max(maxval,dx);
                        }
                        chart_data.push([tx, ser_dim2[vname]['data'][j],dx]);
                    }
                } 
                if (ser_times.length) {
                    first_time = (ser_time0 + ser_times[0]) * 1000;
                }

                // var colsize = 3600 * 1000;
                var colsize = (maxtime - mintime) / (ser_times.length - 1);
                var rowsize = (maxdim2 - mindim2) / (ser_dim2.length - 1);

                $( this ).highcharts({
                    chart: {
                        borderWidth: 1,
                        type: 'heatmap',
                        zoomType: 'xy',
                        panning: true,
                        panKey: 'shift',
                        spacing: [10, 10, 5, 5], // top,right,bot,left
                        plotOptions: {
                            series: {
                                dataGrouping: {
                                    dateTimeLabelFormats: {
                                        millisecond:
                                            ['%Y-%m-%d %H:%M:%S.%L %Z', '%Y-%m-%d %H:%M:%S.%L', '-%H:%M:%S.%L %Z'],
                                        second:
                                            ['%Y-%m-%d %H:%M:%S %Z', '%Y-%m-%d %H:%M:%S', '-%H:%M:%S %Z'],
                                        minute:
                                            ['%Y-%m-%d %H:%M %Z', '%Y-%m-%d %H:%M', '-%H:%M %Z'],
                                        hour:
                                            ['%Y-%m-%d %H:%M %Z', '%Y-%m-%d %H:%M', '-%H:%M %Z'],
                                        day:
                                            ['%Y-%m-%d %Z', '%Y-%m-%d', '-%m-%d %Z'],
                                        week:
                                            ['Week from %Y-%m-%d', '%Y-%m-%d', '-%Y-%m-%d'],
                                        month:
                                            ['%Y-%m', '%Y-%m', '-%Y-%m'],
                                        year:
                                            ['%Y', '%Y', '-%Y'],
                                    },
                                },
                            },
                        },
                    },
                    credits: {  // highcharts.com link
                        enabled: (plotindex == nplots-1),
                    },
                    title: {
                        text: long_name + '(' + units + ')',
                        // style: {"color": "black", "fontSize": "14px", "fontWeight": "bold", "text-decoration": "underline"},
                        style: {"color": "#333333", "fontSize": "14px"},
                        margin: 0,
                    },
                    xAxis: {
                        type: 'datetime',
                        dateTimeLabelFormats: {
                            millisecond: '%H:%M:%S.%L',
                            second: '%H:%M:%S',
                            minute: '%H:%M',
                            hour: '%H:%M',
                            day: '%Y<br/>%m-%d',
                            month: '%Y<br/>%m',
                            year: '%Y',
                        },
                        title: {
                            align: "low",
                            text: local_ns.format_time(first_time,
                                    "YYYY-MM-DD HH:mm ZZ") +
                                " (" + local_ns.plotTimezone + ")",
                        },
                        ordinal: false,
                    },
                    yAxis: {
                        title: {
                            text: dim2_name + '(' + dim2_units + ')',
                        },
                        min: mindim2,
                        max: maxdim2,
                        tickWidth: 2,
                    },
                    colorAxis: {
                        stops: [
                            [0, '#3060cf'],
                            [0.5, '#fffbbc'],
                            [0.9, '#c4463a'] ],
                        min: minval,
                        max: maxval,
                        reversed: false,
                        // maxPadding: 0.2, does seem to have an effect
                        // minPadding: 0.2,
                        startOnTick: false,
                        endOnTick: false,
                        // minColor: '#FFFFFF',
                        // maxColor: Highcharts.getOptions().colors[0]
                    },
                    legend: {
                        title: vname,
                        align: 'right',
                        layout: 'vertical',
                        margin: 15,
                        verticalAlign: 'bottom',
                        useHTML: true,
                    },
                    tooltip: {
                        enabled: true,
                        /*
                           headerFormat: vname + "<br/>",
                           */
                        headerFormat: '',
                        pointFormat:
                            vname + '={point.value}, ' + dim2_name +
                                '={point.y}, {point.x:%Y-%m-%d %H:%M:%S.%L %Z}',
                        // xDateFormat: '%Y-%m-%d %H:%M:%S.%L %Z',
                    },
                    series:[{
                        name: vname,
                        data: chart_data,
                        colsize: colsize,
                        rowsize: rowsize,
                    }],
                });
            }
        });

        $plots = $("div[id^='sounding-profile']");
        nplots = $plots.length;
        $plots.each(function(plotindex) {

            // track_real_time not supported (yet) for soundings
            local_ns.track_real_time = false;

            var sname =  $( this ).data("series");
            var vnames =  $( this ).data("variables");
            var vunits =  $( this ).data("units");
            var long_names =  $( this ).data("long_names");
            if (long_names.length === 0) {
                long_names = vnames;
            }

            var yvar =  sounding_yvar;
            var yvar_unit = vunits[vnames.indexOf(yvar)];

            var ptitle = "";

            // var unique_units = local_ns.unique(vunits);

            if (vnames.length > 1) {
                for (var i = 0; i < vnames.length; i++) {
                    if (i == vnames.length - 1) {
                        ptitle += vnames[i];
                    } 
                    else {
                        ptitle += (vnames[i] + ", "); 
                    }
                }
            }
            else {
                ptitle = vnames[0];
            }

            ptitle = sname + ": "  + ptitle;

            // the altitude array
            var var_index = plot_vmap[sname][yvar];
            var ser_data = plot_data[sname];
            var altitudes = ser_data[var_index];

            var data_length = altitudes.length;
            var skip;
            if (data_length < 1000) {
                skip = 1;
            }
            else {
                skip = Math.round(data_length/1000);
            }

            var alt_increasing = true;  // are altitudes increasing?
            if (data_length > 1) {
                // check first and last
                var alt1 = null;
                for (var i = 0; i < data_length; i++) {
                    alt1 = altitudes[i];
                    if (alt1 !== null) break;
                }
                // console.log("alt1=",alt1);
                var altn = null;
                for (var i = data_length - 1; i >= 0; i--) {
                    altn = altitudes[i];
                    if (altn !== null) break;
                }
                // console.log("altn=",altn);
                alt_increasing = (alt1 !== null && altn > alt1);
            }

            var alt_check_func;
            var last_val_init;
            if (alt_increasing) {
                last_val_init = -Number.MAX_VALUE;
                alt_ok = function(x,xlast) {
                    return x !== null && x > xlast;
                };
            } else {
                last_val_init = Number.MAX_VALUE;
                alt_ok = function(x,xlast) {
                    return x !== null && x < xlast;
                };
            }

            var yAxes = [];
            var series = [];
            var units = [];

            for (var iv = 0; iv < vnames.length; iv++) {
                var vname = vnames[iv];
                if (vname == yvar) continue;
                var_index = plot_vmap[sname][vname];
                var vunit = vunits[iv];
                var vdata = [];
                var last_val = last_val_init;
                for (var idata = 0; idata < data_length; idata+=skip) {
                    var x = altitudes[idata];
                    if (alt_ok(x,last_val)) {
                        var y = ser_data[var_index][idata];
                        vdata.push([x,y]);
                            last_val = x;
                    }
                }

                var unitIndex = $.inArray(vunit, units);

                if (unitIndex == -1) {
                    unitIndex = units.push(vunit) - 1;

                    var yaxis = {
                        title: {
                            text: vunit,
                            // style: {"color": "black", "fontSize": "14px"},
                            margin: 0
                        },
                        lineWidth: 1,
                        // minorGridLineDashStyle: 'longdash',
                        // minorTickInterval: 'auto',
                        // minorTickWidth: 0,
                        // gridLineWidth: (yAxes.length == 0 ? 1 : 0),
                        gridLineWidth: 1,
                        opposite: (unitIndex % 2 !== 0),
                        /* Need to start/end on tick if you have
                         * gridlines on multiple axes */
                        startOnTick: true,
                        endOnTick: true,
                        maxPadding: 0,
                        minPadding: 0,
                    };
                    yAxes.push(yaxis);
                }

                var vseries = {
                    yAxis: unitIndex,
                    data: vdata,
                    name: vname + ' (' + vunit + ')',
                    lineWidth: 1,
                };

                series.push(vseries);		    
            }

            $(this).highcharts({
                chart: {
                    borderWidth: 1,
                    showAxes: true,
                    inverted: true,
                    type: 'line',
                    zoomType: 'xy',
                    spacing: [10, 10, 5, 5],    // top,right,bot,left
                },
                credits: {  // highcharts.com link
                    enabled: (plotindex == nplots-1),
                },
                xAxis: {
                    reversed: false,
                    startOnTick: false,
                    endOnTick: false,
                    title: {
                        text: yvar + ' (' + yvar_unit + ')',
                        // style: {"color": "black", "fontSize": "14px"},
                    },
                    gridLineWidth: 1,
                },
                yAxis: yAxes,
                legend: {
                    enabled: true,
                    margin: 0,
                    useHTML: true,
                },
                rangeSelector: {
                    enabled: false,
                },
                scrollbar: {
                    enabled: false,
                },
                series: series,
                title: {
                    text: ptitle,
                    // style: {"color": "black", "fontSize": "14px", "fontWeight": "bold", "text-decoration": "underline"},
                    style: {"color": "#333333", "fontSize": "14px"},
                    margin: 0,
                },
                tooltip: {
                    shared: true,       // show all points in the tooltip
                    headerFormat: '<span style="font-size: 10px"><b>' + yvar + ': {point.key}</b></span><br/>',
                },
            });
        });
        if (local_ns.track_real_time) {
            if (first_time) {
                local_ns.update_start_time(first_time);
            } 
            // mean delta-t of data
            local_ns.ajaxTimeout = 10 * 1000;   // 10 seconds
            if ('' in plot_times && plot_times[''].length > 1) {
                // set ajax update period to 1/2 the data deltat
                local_ns.ajaxTimeout = Math.max(local_ns.ajaxTimeout, Math.ceil((plot_times[''][plot_times[''].length-1] - plot_times[''][0]) / (plot_times[''].length - 1) * 1000 / 2));
            }
            if (local_ns.debug_level > 2) {
                // update more frequently for debugging
                local_ns.ajaxTimeout = 10 * 1000;
            }

            // start AJAX
            setTimeout(local_ns.do_ajax,local_ns.ajaxTimeout);

            if (local_ns.debug_level) {
                console.log("ajaxTimeout=",local_ns.ajaxTimeout);
            }
        }

        var current_top = document.documentElement.scrollTop || document.body.scrollTop;
        var plot_top = $("#plot_button").offset().top;
        if (current_top < plot_top) {
            local_ns.scroll(plot_top);
        }
    });     // end of DOM-is-ready function
}));
