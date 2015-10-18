/*** configuration ***/
var send_timeout = 20000;
var retry_rate = 5000;
var format_count = d3.format(",.0f");
var format_date = d3.time.format("%Y-%m-%d");

var month_name = ["Jan", "Feb", "Mar", "Apr",
                "May", "Jun", "Jul", "Aug",
                "Sep", "Oct", "Nov", "Dec"];
var day_name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* n-gram graph configuration */
var n_gram_margin = {top: 50, right: 50, bottom: 80, left: 50};
var n_gram_outer_width = 800;
var n_gram_aspect_ratio = 0.4;
var n_gram_bin_num = 30;

var n_gram_phrases;
var n_gram_hists;
var n_gram_bgbar;
var n_gram_bar;
var n_gram_info_anchor = 'n_gram_info';
var n_gram_info_page_size = 10;
var n_gram_info_buffer = ["buffer0", "buffer1"];
var n_gram_info_metadata;
var n_gram_info_idx = 0;
var n_gram_info_tabid = 0;
var n_gram_min_date = "1970-01-01";
var n_gram_max_date = "2015-01-01";
var n_gram_ajax_search;
var n_gram_ajax_lazyload;

/* authorship graph configuration */
var author_margin = n_gram_margin,
    author_height = 600 - author_margin.top - author_margin.bottom;

/*** helper functions ***/
function Blocker(sleeper) {
    this.counter = 0;
    this.waiting = false;
    this.sleeper = sleeper;
}

Blocker.prototype.setHook = function() {
    var blocker = this;
    return function() {
        blocker.counter++;
    }
}
Blocker.prototype.setNotifier = function(cb) {
    var blocker = this;
    return function() {
        if (cb)
            cb.apply(this, arguments);
        if (--blocker.counter == 0 && blocker.waiting)
            blocker.sleeper();
    }
};

Blocker.prototype.go = function() {
    if (this.counter == 0)
        this.sleeper();
    this.waiting = true;
}

function hex(x) {
    return ("0" + parseInt(x).toString(16)).slice(-2);
}

function hex_to_rgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

var line_colors = d3.scale.category10();
function get_color(idx) {
    var rgb = hex_to_rgb(line_colors(idx % 10));
    rgb.r = (rgb.r + 200) / 2.0;
    rgb.g = (rgb.g + 200) / 2.0;
    rgb.b = (rgb.b + 200) / 2.0;
    return '#' + hex(rgb.r) + hex(rgb.g) + hex(rgb.b);
}

function max_date(prev_val, cur_val, index, array) {
    return Math.max(prev_val, cur_val.date);
}

function min_date(prev_val, cur_val, index, array) {
    return Math.min(prev_val, cur_val.date);
}

Array.prototype.extend = function (other_array) {
    other_array.forEach(function(v) {this.push(v)}, this);
}

Date.prototype.toUTCDateString = function () {
    var date = this.getUTCDate();
    date = date > 9 ? date: "0" + date;
    return day_name[this.getUTCDay()] + " " +
        month_name[this.getUTCMonth()] + " " +
         date + " " + this.getUTCFullYear();
}

function block_element_and_wait(selector) {
    var note = document.createElement('div');
    var overlay = document.createElement('div');
    var height = Math.max(selector.height(), 200);
    var width = selector.width();
    var pos = selector.position();
    var text = document.createElement('span');
    var spinner = document.createElement('span');

    text.innerHTML = "Please wait...";
    text.className = "blocknotetext";

    spinner.className = "glyphicon glyphicon-refresh spin";

    selector.toggleClass('blocked', true);
    note.className = "blocknote";
    note.style.top = (height - 50) / 2 + 'px';
    note.style.left = (width - 200) / 2 + 'px';
    note.appendChild(spinner);
    note.appendChild(text);

    overlay.className = "blockoverlay";
    overlay.style.top = pos.top + 'px';
    overlay.style.left = pos.left + 'px';
    overlay.style.height = height + 'px';
    overlay.style.width = width + 'px';
    overlay.appendChild(note);

    selector.parent().append(overlay);
    selector.data('_blockoverlay', overlay);
    selector.data('_blocknote', note);
    selector.data('_blocked', true);
}

function unblock_element_and_finish(selector) {
    if (selector.data('_blocked'))
    {
        $(selector.data('_blockoverlay')).remove();
        $(selector.data('_blocknote')).remove();
        selector.data('_blocked', undefined);
        selector.toggleClass('blocked', false);
    }
}

var svg; /* canvas */

var n_gram_width, n_gram_height;
function n_gram_setup() {
    var canvas = d3.select("#canvas");
    /* setup svg */
    var n_gram_outer_height = n_gram_outer_width * n_gram_aspect_ratio;
    n_gram_width = n_gram_outer_width - n_gram_margin.left - n_gram_margin.right;
    n_gram_height = n_gram_outer_height - n_gram_margin.top - n_gram_margin.bottom;
    var outer_svg = canvas.append("svg")
                .attr("width", n_gram_outer_width)
                .attr("height", n_gram_outer_height)
                .attr("viewBox", "0 0 " + n_gram_outer_width + " " + n_gram_outer_height)
    function auto_adjust() {
        var new_width = canvas.style("width");
        outer_svg.attr("width", parseInt(new_width));
        outer_svg.attr("height", parseInt(new_width) * n_gram_aspect_ratio);
    }
    auto_adjust();
    $(window).resize(auto_adjust);
    svg = outer_svg.append("g")
                .attr("transform", "translate(" + n_gram_margin.left + "," + n_gram_margin.top + ")");
    var defs = outer_svg.append("svg:defs");
    var gradient = defs.append("svg:linearGradient")
        .attr("id", "gradient")
        .attr("x1", "0").attr("y1", "0")
        .attr("x2", "0").attr("y2", "1");
    gradient.append("svg:stop")
        .attr("offset", "0%")
        .attr("stop-color", "#222")
        .attr("stop-opacity", "0");
    gradient.append("svg:stop")
        .attr("offset", "100%")
        .attr("stop-color", "#aaa")
        .attr("stop-opacity", "1");
    var gradient2 = defs.append("svg:linearGradient")
        .attr("id", "gradient2")
        .attr("x1", "0").attr("y1", "0")
        .attr("x2", "0").attr("y2", "1");
    gradient2.append("svg:stop")
        .attr("offset", "0%")
        .attr("stop-color", "#666")
        .attr("stop-opacity", "0");
    gradient2.append("svg:stop")
        .attr("offset", "100%")
        .attr("stop-color", "#444")
        .attr("stop-opacity", "1");
   
    svg.append("g")
        .attr("id", "x-axis")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + n_gram_height + ")");

    svg.append("g")
        .attr("id", "y-axis")
        .attr("class", "y axis");

    svg.append("g")
        .attr("id", "bgbars");

    svg.append("g")
        .attr("id", "bars");

    svg.append("g")
        .attr("id", "overbars");
   
    svg.append("g")
        .attr("id", "lines");
}

function n_gram_preprocessing(raw_data) {
    raw_data.map(function (cur_val, index, array) {
                    cur_val.date = new Date(cur_val.date);
                    return cur_val;
                });
    return raw_data;
}

var n_gram_info_page_base;

function n_gram_info_fill(buffer_name, d) {
    var table = $("#" + buffer_name + " > table");
    table.html('');
    d.map(function(dd) {
        table.append("<tr><td>" + dd.title + "</td><td>" +
                        dd.date.toUTCDateString() + "</td></tr>");
    });
}

function n_gram_info_setup(anchor, bin_num) {
    n_gram_info_metadata = [];
    var wrapper = document.createElement('div');
    var buffers = document.createElement('div');
    var container = document.getElementById(anchor);
    buffers.id = 'buffers';
    for (var i = 0; i < n_gram_info_buffer.length; i++)
    {
        var buff = document.createElement('div');
        buff.id = n_gram_info_buffer[i];
        buffers.appendChild(buff);
    }
    wrapper.id = 'buffer_wrapper';
    wrapper.className = 'tab-content';
    wrapper.appendChild(buffers);
    var pager = document.createElement('ul');
    var prev = document.createElement('li');
    var next = document.createElement('li');
    pager.className = 'pager';
    prev.className = "previous";
    prev.innerHTML = "<a href='#'>Previous</a>";
    next.className = "next";
    next.innerHTML = "<a href='#'>Next</a>";
    pager.appendChild(prev);
    pager.appendChild(next);
    container.appendChild(wrapper);
    container.appendChild(pager);

    for (var i = 0; i < bin_num; i++)
    {
        var tabs = [];
        for (var j = 0; j < n_gram_phrases.length; j++)
            tabs.push([]);
        n_gram_info_metadata.push(tabs);
    }
    n_gram_info_buffer.forEach(function (cur_val, index, array) {
        var buffer = $('#' + cur_val);
        buffer.replaceWith("<div id='" + cur_val +
                           "' style='height: 0; overflow-x: hidden;" +
                           " overflow-y: auto; position: absolute'>" +
                     "<table class='table table-striped table-hover'></table>" +
                     "</div>");
        $('#buffers').css('display', 'none');
        $('.pager').css('display', 'none');
    });
}

function n_gram_info_lazyload(new_base, cb) {
    var buffer_name = n_gram_info_buffer[0];
    var buffer = $('#' + buffer_name);
    var bin_metadata = n_gram_info_metadata[n_gram_info_idx][n_gram_info_tabid];
    var b = new Blocker(cb);
    var n_gram_ajax_site = $SCRIPT_ROOT + '/n-gram-query';
    if (new_base == bin_metadata.length && /* at the end of the list */
        bin_metadata.length < n_gram_hists[n_gram_info_tabid][n_gram_info_idx].y) 
    {
        b.setHook()();
        b.go();
        n_gram_ajax_lazyload_abort();
        n_gram_ajax_lazyload = send_request(n_gram_ajax_site,
                          { action: 'bin',
                            idx: n_gram_info_idx,
                            entry_start: new_base,
                            entry_num: n_gram_info_page_size, 
                            words: JSON.stringify(n_gram_phrases[n_gram_info_tabid])},
                 function(resp) {
                     resp = n_gram_preprocessing(resp);
                     bin_metadata = n_gram_info_metadata[n_gram_info_idx][n_gram_info_tabid];
                     bin_metadata.extend(resp);
                     b.setNotifier()();
                     n_gram_ajax_lazyload = null;
                     unblock_element_and_finish($('#n_gram_info'));
                 });
        block_element_and_wait($('#n_gram_info'));
    }
    else b.go();
}

function n_gram_info_render(idx, tabid) {
    var buffer_name = n_gram_info_buffer[0];
    var buffer = $('#' + buffer_name);
    /* abort waiting request before changing the state variable */
    if (idx != null) n_gram_info_idx = idx;
    if (tabid != null) n_gram_info_tabid = tabid;
    n_gram_ajax_lazyload_abort();
    n_gram_info_lazyload(0, function () {
        var bin_metadata = n_gram_info_metadata[n_gram_info_idx][n_gram_info_tabid];
        if (bin_metadata.length == 0)
            return;
        n_gram_info_page_base = 0;
        n_gram_info_fill(buffer_name, bin_metadata.slice(n_gram_info_page_base,
                                                        n_gram_info_page_size));

        $('#buffers').css('display', 'block');
        $('.pager').css('display', 'block');
        buffer.css('height','auto')
                .data('new_height',buffer.height())
        var buffer_height = buffer.data('new_height');
        var buffer_width;
        function auto_adjust() {
            buffer_width = $("#buffer_wrapper").width();
            $("#buffers").css('width', buffer_width)
                        .css('height', buffer_height);
            buffer.css('width', buffer_width);
            for (var i = 0; i < n_gram_info_buffer.length; i++)
            {
                var b = document.getElementById(n_gram_info_buffer[i]);
                b.style.height = buffer_height + 'px';
                b.style.width = buffer_width + 'px';
            }
        }
        auto_adjust();
        $(window).resize(auto_adjust);
        $('.pager').css('opacity', 0).stop(true);
        var b = new Blocker(function () {
            $('.pager').animate({ opacity: 1 }, 400);
        });
        b.setHook();
        buffer.height(0)
                .animate({ height: buffer_height }, 400, "swing", b.setNotifier());
        b.go();
        function slide(dir) {
            return function () {
                dir = dir > 0 ? 1 : -1;
                var new_base = n_gram_info_page_base + dir * n_gram_info_page_size;
                if (new_base < n_gram_hists[n_gram_info_tabid][n_gram_info_idx].y && new_base >= 0)
                {
                    n_gram_info_lazyload(new_base, function () {
                        n_gram_info_page_base = new_base;
                        old_buffer_name = n_gram_info_buffer[0];
                        new_buffer_name = n_gram_info_buffer[1];
                        old_buffer = $("#" + old_buffer_name);
                        new_buffer = $("#" + new_buffer_name);
                        n_gram_info_fill(new_buffer_name,
                                           bin_metadata.slice(new_base,
                                                new_base + n_gram_info_page_size));
                        new_buffer.css('height', buffer_height)
                                .css('width', buffer_width)
                                .css('left', dir * buffer_width);
                        var b = new Blocker(function () {
                            var t = n_gram_info_buffer[0];
                            n_gram_info_buffer[0] = n_gram_info_buffer[1];
                            n_gram_info_buffer[1] = t;
                        });
                        b.setHook()();
                        b.setHook()();
                        old_buffer.animate({left: dir * -buffer_width}, 300, "swing", b.setNotifier());
                        new_buffer.animate({left: 0}, 300, "swing", b.setNotifier());
                        b.go();
                    });
                }
                return false;
            };
        }
        $(".pager .next").unbind("click").on("click", slide(1));
        $(".pager .previous").unbind("click").on("click", slide(-1));
    });
}

function calc_histogram_old(papers) {
    var start_date = new Date(n_gram_min_date);
    var end_date = new Date(n_gram_max_date);
    var bin_gap = Math.floor((end_date - start_date) / n_gram_bin_num);
    var bin_thresholds = [start_date];

    for (var i = 0, prev = start_date.getTime(), now;
         i < n_gram_bin_num; i++, prev = now)
        bin_thresholds.push(new Date(now = prev + bin_gap));

    var hists = papers.map(function (cur_val, index, array) {
                        return d3.layout.histogram()
                            .value(function (d) { return d.date; })
                            .bins(bin_thresholds)(cur_val)
                            .map(function (cur_val, index, array) {
                                cur_val.pos = index;
                                return cur_val;
                            });
                        });
    return [start_date, end_date, hists];
}

function calc_histogram(resps) {
    var start_date = new Date(resps[0].start_date);
    var end_date = new Date(resps[0].end_date);
    var bin_gap = Math.floor((end_date - start_date) / resps[0].bin_num);
    var hists = [];
    for (var i = 0; i < resps.length; i++)
    {
        var raw_hist = resps[i].hist;
        var hist = [];
        var cur_x = start_date.getTime();
        for (var j = 0; j < raw_hist.length; j++, cur_x += bin_gap)
            hist.push({x: new Date(cur_x), dx: bin_gap, y: raw_hist[j]});
        hists.push(hist);
    }
    return [start_date, end_date, hists];
}

function n_gram_render(phrases, resps) {
    if (resps.length < 1) return;
    n_gram_phrases = phrases;
    var res = calc_histogram(resps);
    var start_date = res[0];
    var end_date = res[1];
    var hists = res[2];
    n_gram_hists = hists;
    n_gram_info_setup(n_gram_info_anchor, hists[0].length);
    var x = d3.time.scale()
            .domain([start_date, end_date])
            .range([0, n_gram_width]);

    var hists_tp = [];
    var hists_bg = [];
    for (var i = 0; i < hists[0].length; i++)
    {
        var bin = [];
        bin.pos = i;
        bin.sum = 0;
        for (var j = 0; j < hists.length; j++)
        {
           var b = hists[j][i];
           bin.sum += b.y;
           bin.push(b);
        }
        hists_tp.push(bin);
        hists_bg.push({pos: bin.pos, x: bin[0].x});
    }

    var x_axis = d3.svg.axis()
                    .scale(x).ticks(5)
                    .orient("bottom").tickFormat(format_date);
/*
    hists_tp = hists_tp.filter(function (cur_val, index, array) {
                        return cur_val.sum > 0;
                    });
*/

    /* begin bar chart */
    var svg_bar = svg.select("#bars");
    var bar = svg_bar.selectAll(".bar")
                    .data(hists_tp, function(d) { return d.pos; });

    var bgbar = svg.select("#bgbars").selectAll(".bar")
                    .data(hists_bg, function(d) { return d.pos; });

    var overbar = svg.select("#overbars").selectAll(".bar")
                    .data(hists_bg, function(d) { return d.pos; });

    if (hists_tp.length > 0)
    {
        var bar_y = d3.scale.linear()
                        .domain([0, d3.max(hists_tp, function(d) { return d.sum; })])
                        .range([n_gram_height, 0]);

        var bin_width = x(new Date(start_date.getTime() + hists_tp[0][0].dx)) * 1;

        var bgbar_enter = bgbar.enter()
                        .append("g")
                        .attr("class", "bar")
                        .attr("transform", function(d) {
                            return "translate(" + x(d.x) + "," + 0 + ")";
                        });
        var overbar_enter = overbar.enter()
                        .append("g")
                        .attr("class", "bar")
                        .attr("transform", function(d) {
                            return "translate(" + x(d.x) + "," + 0 + ")";
                        })
                        .on("mouseover", function(d, i) {
                            d3.select(bgbar[0][i]).select('rect')
                                .transition()
                                .duration(100)
                                .style('opacity', '1');
                            d3.select(bar[0][i]).classed('bar_hover', true);
                        })
                        .on("mouseout", function(d, i) {
                            d3.select(bgbar[0][i]).select('rect')
                                .transition()
                                .duration(100)
                                .style('opacity', '0');
                            d3.select(bar[0][i]).classed('bar_hover', false);
                        })
                        .on("click", function(d, i) {
                            n_gram_info_render(d.pos, null);
                        });

        var bar_enter = bar.enter()
                    .append("g")
                    .attr("class", "bar")
                    .attr("transform", function(d) {
                        return "translate(" + x(d[0].x) + "," + bar_y(0) + ")";
                    });
        bgbar_enter.append("rect")
            .attr("x", 1)
            .attr("y", -1)
            .style('fill', 'url(#gradient)')
            .style('opacity', '0')
            .attr("width", bin_width)
            .attr("height", function(d) { return n_gram_height; });

        bar_enter.append("rect")
            .style('fill', 'url(#gradient2)')
            .attr("x", 1)
            .attr("y", -1)
            .attr("width", bin_width)
            .attr("height", function(d) { return n_gram_height - bar_y(0); });

        overbar_enter.append("rect")
            .attr("x", 1)
            .attr("y", -1)
            .attr("width", bin_width)
            .attr("height", function(d) { return n_gram_height; });

        bar.select("rect")
            .transition()
            .duration(300)
            .attr("width", bin_width)
            .attr("height", function(d) { return n_gram_height - bar_y(d.sum); });

        bar.transition()
            .duration(300)
            .attr("transform", function(d) {
                    return "translate(" + x(d[0].x) + "," + bar_y(d.sum) + ")";
                });

        /*
        bar_enter.append("text")
            .attr("dy", "-.75em")
            .attr("y", 6)
            .attr("x", bin_width / 2)
            .attr("text-anchor", "middle")
            .text(function(d) { return format_count(d.sum); });

        bar.select("text")
            .attr("x", bin_width / 2)
            .attr("text-anchor", "middle")
            .text(function(d) { return format_count(d.sum); });
        */
    }
    bar.exit().remove();
    bgbar.exit().remove();
    overbar.exit().remove();
    /* end bar chart */

    /* begin line chart */
    var svg_lines = svg.select("#lines");
    var line = svg_lines.selectAll(".line")
                .data(hists);
    if (hists_tp.length > 0)
    {
        var line_y = d3.scale.linear()
                        .domain([0, d3.max($.map(hists, function (data) {
                                    return d3.max(data, function(d) { return d.y; }); }))],
                            function(d) { return d.y; })
                        .range([n_gram_height, 0]);

        var y_axis = d3.svg.axis().scale(line_y).ticks(5)
                        .orient("left").tickFormat(function(e) {
                                                    if (Math.floor(e) != e) return;
                                                    return e;
                                                    });

        var valueline = d3.svg.line()
            .x(function (d) { return x(d.x) + bin_width / 2.0; })
            .y(function (d) { return line_y(d.y); });
        var enter_blocker = new Blocker(function() {});
        var line_enter = line.enter()
                            .append("g")
                            .attr("class", "line")
                            .append("path")
                            .attr("opacity", "0");

        line.select("path")
            .transition()
            .duration(300)
            .attr("d", function (d) { return valueline(d); })
            .attr("stroke", function (d, i) {
                var color = get_color(i);
                 d.color = color;
                 return color;
            })
            .each(function (d) {
                d.line = this;
            })
            .each(enter_blocker.setHook())
            .each("end", enter_blocker.setNotifier(function () {
                line_enter.transition()
                            .duration(300)
                            .attr("opacity", "1")
            }));
    }

    line.exit()
        .attr("opacity", "1")
        .transition()
        .duration(300)
        .attr("opacity", "0")
        .remove();
    /* end line chart */

    /* begin legend */
    var ldata = [];
    for (var i = 0; i < hists.length; i++)
        ldata.push({idx: i,
                    phrase: phrases[i].join(' '),
                    color: hists[i].color,
                    line: hists[i].line });
    var legends = d3.select("#legends")
                    .attr("class", "nav nav-tabs")
                    .selectAll(".legend").data(ldata);
    var l = legends.enter()
            .append("li")
            .attr("class", "legend")
            .each(function (d, i) {
                if (d.idx == n_gram_info_tabid)
                    d3.select(this).classed("active", true);
            })
            .on("mouseover", function (d) {
                d3.select(d.line).classed("selected", true);
            })
            .on("mouseout", function (d) {
                d3.select(d.line).classed("selected", false);
            })
            .on("click", function (d) {
                d3.select(this.parentNode
                            .childNodes[n_gram_info_tabid + 1])
                                .classed("active", false);
                d3.select(this).classed("active", true);
                n_gram_info_render(null, d.idx);
            });
    l.append("a");
    legends.select("a").style("background-color", function (d) { return d.color; })
                        .text(function (d) { return d.phrase; });

    legends.exit().remove();
    /* end legend */

    /* update axes */
    svg.select("#x-axis")
        .transition()
        .duration(300).call(x_axis);
    svg.select("#y-axis")
        .transition()
        .duration(300).call(y_axis);

    var flag = true;
    for (var i = 0; i < phrases.length && flag; i++)
        for (var j = 0; j < hists_tp.length; j++)
            if (hists_tp[j][i].y > 0)
            {
                var tabs = $('#legends .legend');
                d3.select(tabs[n_gram_info_tabid]).classed("active", false);
                n_gram_info_render(hists_tp[j].pos, i);
                d3.select(tabs[n_gram_info_tabid]).classed("active", true);
                flag = false;
                break;
            }
}

//render(values);

function send_request(url, data, on_success) {
    return $.ajax({
        url: url,
        type: 'POST',
        cache: false,
        dataType: 'json',
        async: true,
        data: data,
        success: on_success,
        timeout: send_timeout,
        error: function(xhr, ajax_options, thrown_error) {
            if (ajax_options == "abort") {
                console.log("request aborted");
                return;
            }
            console.log(ajax_options);
            console.log("status=" + xhr.status);
            console.log("responseTest=" + xhr.responseText);
            console.log("error=" + thrown_error);
            setTimeout(function() { $.ajax(this); }, retry_rate);
        }
    });
}

function send_user_request(url, data, on_success) {
    var btn = $("#submit");
     btn.prop("disabled", true);
    $("#submit .spinclip .glyphicon").toggleClass('spin', true);
    $("#submit").toggleClass('active', true);
    return send_request(url, data, function(resp) {
        on_success(resp);
        btn.prop("disabled", false);
        $("#submit").toggleClass('active', false);
        $("#submit .spinclip .glyphicon").toggleClass('spin', false);
    });
}

function n_gram_ajax_lazyload_abort() {
    if (n_gram_ajax_lazyload != null)
    {
        console.log('aborting');
        unblock_element_and_finish($('#n_gram_info'));
        n_gram_ajax_lazyload.abort();
        n_gram_ajax_lazyload = null;
    }
}

function n_gram_search(phrases) {
    phrases = phrases.split(',').filter(function (cur_val, index, array) {
                    return cur_val != "";
                })
                .map(function (cur_val, index, array) {
                    return cur_val.trim().split(" ")
                });

    var waiting = phrases.length;
    var resps = [];
    var n_gram_ajax_site = $SCRIPT_ROOT + '/n-gram-query';
    n_gram_ajax_lazyload_abort();
    phrases.forEach(function (cur_val, index, array) {
        n_gram_ajax_search = send_user_request(n_gram_ajax_site,
                { action: 'hist', words: JSON.stringify(cur_val)},
                 function(resp) {
                     resps[index] = resp;
                     if (--waiting == 0)
                     {
                         n_gram_render(phrases, resps);
                         n_gram_ajax_search = null;
                     }
                 })});
}

var author_width;
function author_setup() {
    var canvas = d3.select("#canvas");
    author_width = parseInt(canvas.style("width")) - author_margin.left - author_margin.right;
    /* setup svg */
    svg = canvas.append("svg")
                .attr("width", author_width + author_margin.left + author_margin.right)
                .attr("height", author_height + author_margin.top + author_margin.bottom)
                .append("g")
                .attr("transform", "translate(" + author_margin.left + "," + author_margin.top + ")");

    /* add def for arrows
    svg.append("svg:defs").selectAll("marker")
        .data(["end"])
        .enter().append("svg:marker") // define arrow shape
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 23.5)
        .attr("refY", -1.1)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .attr("orient", "auto")
        .append("svg:path")
        .attr("d", "M0,-5L10,0L0,5");
    */
}

function author_render(graph, names, from, to) {
    var links = [];
    var num_nodes = 0;
    for (var node in graph) {
        var node_data = graph[node];
        node_data.name = node;
        if (!('click_count' in node_data)) {
            node_data.click_count = 1;
        }
        node_data.forEach(function (cur_val, index, array) {
            links.push({source: node_data,
                        target: graph[cur_val.to]});
        });
        num_nodes++;
    }

    var nodes = d3.values(graph);
    if (num_nodes == 0) {
        empty_graph = {};
        empty_graph['empty'] = Object();
        if (to == null) {
            empty_graph['empty'].name = 'Did not find author ' + from;
        } else {
            empty_graph['empty'].name = from + ' and ' + to + ' are more than 4 hops away';
        }
        nodes = d3.values(empty_graph);
    }
    
    var force = d3.layout.force()
                    .nodes(nodes)
                    .links(links)
                    .size([author_width, author_height])
                    .linkDistance(250)
                    .charge(-400)
                    .on("tick", tick)
                    .start();
 
    svg.select("g").remove();
    /* add the links and the arrows */
    var path = svg.append("svg:g").selectAll("path")
                    .data(force.links())
                    .enter().append("svg:path")
                    .attr("class", "link")
                    .attr("marker-end", "url(#end)");

    svg.selectAll(".node").remove();
    /* define the nodes */
    var node = svg.selectAll(".node")
                    .data(force.nodes())
                    .enter().append("g")
                    .attr("class", "node")
                    .call(force.drag);

    node.append("circle")
        .attr("r", 10)
        .on("click", function(d) {
            if (d.click_count == 1) {
                author_search(d.name, graph, names);
                d.click_count = 2;
            } else if (d.click_count == 2) {
                window.open('http://citeseerx.ist.psu.edu/search?q=' + names[d.name] + '&submit=Search&sort=rlv&t=doc', '_blank');
                d.click_count = 3;
            }
        });
    // border around to and from nodes
    node.append("circle")
        .attr("r", function(d) {
            if (d.name == from || d.name == to) {
                return 12;
            } else {
                return 0;
            }
        })
        .style("stroke", "green")
        .style("fill", "none");

    node.append("text")
        .attr("x", 14)
        .attr("dy", ".35em")
        .text(function(d) { return d.name; });

    var padding = 20, // separation between circles
        radius=20;
    function collide(alpha) {
        var quadtree = d3.geom.quadtree(nodes);
        return function(d) {
            var rb = 2*radius + padding,
                nx1 = d.x - rb,
                nx2 = d.x + rb,
                ny1 = d.y - rb,
                ny2 = d.y + rb;
            quadtree.visit(function(quad, x1, y1, x2, y2) {
                    if (quad.point && (quad.point !== d)) {
                    var x = d.x - quad.point.x,
                    y = d.y - quad.point.y,
                    l = Math.sqrt(x * x + y * y);
                    if (l < rb) {
                    l = (l - rb) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                    }
                    }
                    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                    });
        };
    }

    function tick() {
        path.attr("d", function(d) {
            var dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            return "M" +
                d.source.x + "," +
                d.source.y + "A" +
                dr + "," + dr + " 0 0,1 " +
                d.target.x + "," +
                d.target.y;
        });

        node.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")"; });
        node.each(collide(0.5));
    }

    for (var i = 0; i < 10; i++)
        force.tick();
}

function author_search(authors, cur_graph, cur_names) {
    var author_ajax_site = $SCRIPT_ROOT + '/authors-query';
    send_user_request(author_ajax_site, { authors: authors, step: 4 },
                function(resp) {
                    from  = resp['from'];
                    to    = resp['to'];
                    graph = resp['graph'];
                    names = resp['names'];
                    for (key in graph) {
                        if (!(key in cur_graph)) {
                    	    cur_graph[key] = graph[key];
                    	} else {
                    	    for (var i = 0; i < graph[key].length; i++) {
                    	        cur_graph[key].push(graph[key][i]);
                    	    }
                    	}
                    }
                    for (key in names) {
                        if (!(key in cur_names)) {
                            cur_names[key] = names[key];
                        }
                    }
                    author_render(cur_graph, cur_names, from, to);
                });
}

var debug_data = [
    {id: 1, title: "A", authors: ["a", "b", "c"], date: "2009"},
    {id: 2, title: "B", authors: ["e", "b", "c"], date: "2009"},
    {id: 3, title: "D", authors: ["a", "e", "c"], date: "2010"},
    {id: 4, title: "C", authors: ["a", "b", "d"], date: "2011"},
    {id: 5, title: "E", authors: ["a", "e"], date: "2013-02-03"},
];
/*
$(function() {
    $('.scroll-pane').jScrollPane();
});
*/
