// Copyright (c) 2016 John Seamons, ZL/KF6VO

function ext_switch_to_client(ext_name, first_time, recv_func)
{
	//console.log('SET ext_switch_to_client='+ ext_name +' first_time='+ first_time +' rx_chan='+ rx_chan);
	extint_recv_func = recv_func;
	extint_ws.send('SET ext_switch_to_client='+ ext_name +' first_time='+ first_time +' rx_chan='+ rx_chan);
}

function ext_send(msg)
{
	extint_ws.send(msg);
}

function ext_panel_show(controls_html, data_html, show_func)
{
	extint_panel_show(controls_html, data_html, show_func);
}

function ext_set_controls_width(width)
{
	var el = html_idname('ext-controls');
	el.style.width = width.toString() +'px';

	panel_set_width('ext-controls', width);
	var el = html_idname('ext-controls');
	var visOffset = el.activeWidth - (visIcon - visBorder);
	el = html_idname('ext-controls-vis');
	el.style.left = visOffset.toString() +'px';
}

function ext_get_cfg_param(path)
{
	return getVarFromString('cfg.'+ path);
}

function ext_set_cfg_param(path, val)
{
	setVarFromString('cfg.'+ path, val);
	cfg_save_json(extint_ws);
}

var ext_zoom = {
	TO_BAND: zoom.to_band,
	IN: zoom.in,
	OUT: zoom.out,
	ABS: zoom.abs,
	MAX_IN: zoom.max_in,
	MAX_OUT: zoom.max_out
};

function ext_tune(fdsp, mode, zoom) {		// specifying mode is optional
	//console.log('ext_tune: '+ fdsp +', '+ mode +', '+ zoom +', '+ arguments[3]);
	freqmode_set_dsp_kHz(fdsp, mode);
	
	if (zoom != undefined) {
		zoom_step(zoom, arguments[3]);
	} else {
		zoom_step(zoom.to_band);
	}
}

function ext_get_freq()
{
	return freq_displayed_Hz;
}

function ext_get_carrier_freq()
{
	return freq_car_Hz;
}

function ext_get_mode()
{
	return cur_mode;
}

function ext_set_mode(mode)
{
	demodulator_analog_replace(mode);
}

function ext_set_passband(low_cut, high_cut, fdsp)		// specifying fdsp is optional
{
	var demod = demodulators[0];
	demod.low_cut = low_cut;
	demod.high_cut = high_cut;
	
	if (fdsp != undefined && fdsp != null) {
		fdsp *= 1000;
		freq_car_Hz = freq_dsp_to_car(fdsp);
	}

	demodulator_set_offset_frequency(0, freq_car_Hz - center_freq);
}

function ext_hasCredential(conn_type, cb)
{
	if (extint_credential[conn_type] == true) {
		console.log('ext_hasCredential: TRUE '+ conn_type);
		return true;
	}

	var pwd = readCookie(conn_type);
	pwd = pwd? pwd:'';	// make non-null
	console.log('ext_hasCredential: readCookie '+ conn_type +'="'+ pwd +'"');
	
	// always check in case not having a pwd is accepted by local subnet match
	extint_pwd_cb = cb;
	ext_valpwd(conn_type, pwd);
	return false;
}

function ext_valpwd(conn_type, pwd)
{
	writeCookie(conn_type, pwd);
	console.log('ext_valpwd: writeCookie '+ conn_type +'="'+ pwd +'"');

	// FIXME: encode pwd
	extint_conn_type = conn_type;
	kiwi_ajax("/PWD?cb=extint_valpwd_cb&type="+ conn_type +"&pwd=x"+ pwd, true);	// prefix pwd with 'x' in case empty
}


// private

var extint_credential = { };
var extint_pwd_cb = null;
var extint_conn_type = null;

function extint_valpwd_cb(badp)
{
	console.log('extint_valpwd_cb: badp='+ badp);
	extint_credential[extint_conn_type] = badp? false:true;
	if (extint_pwd_cb) extint_pwd_cb(badp);
}

var extint_ws, extint_recv_func;

function extint_connect_server()
{
	extint_ws = open_websocket("EXT", timestamp, function(data) {
		var stringData = arrayBufferToString(data);
		var param = stringData.substring(4).split("=");

		switch (param[0]) {

			case "keepalive":
				break;

			case "ext_client_init":
				extint_focus();
				break;

			default:
				//console.log('ext WS '+ data);
				if (extint_recv_func)
					extint_recv_func(data);
				break;
		}
	});

	// when the stream thread is established on the server it will automatically send a "SET init" to us
	setTimeout(function() { setInterval(function() { extint_ws.send("SET keepalive") }, 5000) }, 5000);
	return extint_ws;
}

var extint_current_ext_name = null;

function extint_blur_prev()
{
	if (extint_current_ext_name != null) {
		w3_call(extint_current_ext_name +'_blur', null);
		extint_current_ext_name = null;
	}
	
	if (extint_ws)
		extint_ws.send('SET ext_blur='+ rx_chan);
}

function extint_focus()
{
	console.log('extint_focus: calling '+ extint_current_ext_name +'_main()');
	w3_call(extint_current_ext_name +'_main', null);
}

// called on extension menu item selection
function extint_select(val)
{
	extint_blur_prev();
	
	var i = parseInt(val)-1;
	extint_current_ext_name = extint_names[i];
	if (!extint_ws) {
		extint_ws = extint_connect_server();
	} else {
		extint_focus();
	}
}

var extint_names;

function extint_list_json(param)
{
	extint_names = JSON.parse(decodeURIComponent(param));
	//console.log('### extint_names=');
	//console.log(extint_names);
}

function extint_select_menu()
{
	var s = '';
	for (var i=0; i < extint_names.length; i++) {
		if (!dbgUs && extint_names[i] == 's4285') continue;	// FIXME: hide while we develop
		s += '<option value="'+ (i+1) +'">'+ extint_names[i] +'</option>';
	}
	//console.log('extint_select_menu = '+ s);
	return s;
}

function extint_override(name)
{
	for (var i=0; i < extint_names.length; i++) {
		if (extint_names[i].includes(name)) {
			//console.log('extint_override match='+ extint_names[i]);
			setTimeout('extint_select('+ (i+1) +')', 3000);
			break;
		}
	}
}
