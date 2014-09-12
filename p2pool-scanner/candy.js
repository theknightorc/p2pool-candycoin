
var fs = require('fs'),
    http = require('http'),
    exec = require('child_process').exec,
	_ = require('underscore'),
    Geo = require('./geo');

function dpc(t,fn) { if(typeof(t) == 'function') setTimeout(t,0); else setTimeout(fn,t); }

function Scanner(options) {

	var self = this;
    self.options = options;

    var config = eval('('+fs.readFileSync("candy.cfg",'utf8')+')');
    var upload = fs.existsSync('upload.cfg') ? eval('('+fs.readFileSync("upload.cfg",'utf8')+')') : null;

    self.addr_pending = { }     // list of addresses waiting scan
    self.addr_digested = { }    // list of scanned addresses
    self.addr_working = { }     // list of working addresses

    self.geo = new Geo({ timeout : config.http_socket_timeout });

  	// -----------------------------------------
   	// local http server interface
    if(config.http_port)
    {
        var express = require('express');
        var app = express();
        app.configure(function(){
            app.use(express.bodyParser());
        });
        app.get('/', function(req, res) {
            var str = self.render();
            res.write(str);
            res.end();
        });

        http.createServer(app).listen(config.http_port, function() {
            console.log("HTTP server listening on port: ",config.http_port);
        });
    }

    var logo = fs.readFileSync("resources/"+config.currency.toLowerCase()+".png","base64");
    if(logo)
        logo = "data:image/png;base64,"+logo;


    self.render = function() {
        var str = "<html><head>"
            +"<style>"
            +"body { font-family: Consolas; font-size: 14px; background-color: #fff; color: #000; }"
            +"a:link { text-decoration: none; color: #0051AD; }"
            +"a:visited { text-decoration: none; color: #0051AD; }"
            +"a:hover { text-decoration: none; color: #F04800; }"
            +".row-grey { background-color: #f3f3f3;  }"
            +".p2p {  width: 1000px; margin: auto; border: 1px solid #aaa;  box-shadow: 2px 2px 2px #aaa; padding: 2px;  }"
            +".p2p-row { width: 980px; padding: 10px; height: 26px; }"
            +".p2p-caption { width: 980px; text-align: center;  background-color: #ddd; padding-top: 4px; padding-bottom: 8px;}"
            +".p2p div { float : left; }"
            +".p2p-ip { width: 300px; text-align:left; }"
            +".p2p-ip2 { width: 300px; text-align:left; }"
            +".p2p-fee { width: 120px; text-align: left;}"
            +".p2p-fee2 { width: 120px; text-align: left;}"
            +".p2p-uptime { width: 120px; text-align: left;}"
            +".p2p-uptime2 { width: 120px; text-align: left;}"
            +".p2p-hashrate { width: 120px; text-align: left;}"
            +".p2p-hashrate2 { width: 120px; text-align: left;}"
            +".p2p-miners { width: 80px; text-align: left;}"
            +".p2p-miners2 { width: 80px; text-align: left;}"
            +".p2p-geo { width: 220px; text-align: left;}"
            +".p2p-geo2 { width: 220px; text-align: left;}"
            +"img { border: none;}"
            +"</style>"
            +"</head><body>";
        if(logo)
            str += "<div style='float:top;margin:auto;'><center><a href='http://candyco.in/' target='_blank'><img src=\""+logo+"\" height='60' /></a></center></div><br style='clear:both;'/>";
        str += "<center>PEER TO PEER "+(config.currency.toUpperCase())+" MINING NETWORK - PUBLIC NODE LIST<br/><span style='font-size:10px;color:#333;'>GENERATED BY P2POOL-SCANNER ON: "+(new Date())+"</span></center><p/>"
        if(self.poolstats)
            str += "<center>Pool speed: "+(self.poolstats.pool_hash_rate/1000000).toFixed(2)+" "+config.speed_abbrev+"</center>";
        // Filtering none public local object 127.0.0.1 and 0.0.0.0
	count = _.size(self.addr_working) - 2;
        str += "<center>Currently observing "+(self.nodes_total || "N/A")+" nodes.<br/>"+count+" nodes are public with following IPs:</center><p/>";
        str += "<div class='p2p'>";
        str += "<div class='p2p-row p2p-caption'><div class='p2p-ip'>IPs</div><div class='p2p-fee'>Fee</div><div class='p2p-uptime'>Uptime</div><div class='p2p-hashrate'>Hash Rate</div><div class='p2p-miners'>Miners</div><div class='p2p-geo'>Location</div>";
        str += "</div><br style='clear:both;'/>";

        var list = _.sortBy(_.toArray(self.addr_working), function(o) { return o.stats ? -o.stats.uptime : 0; })

        var row = 0;
        _.each(list, function(info) {
            var local_hash_rate = info.local_hash_rate;
            var miner_count = info.miner_count;
            var ip = info.ip;
	    
            if (ip == '54.68.122.230') {
                ip = 'candyp2pool-west.dprcoin.com';
            }
            if (ip == '54.197.242.142') {
                ip = 'candyp2pool-east.dprcoin.com';
            }
            if (ip == '174.6.107.108') {
                ip = 'candyp2pool-yvr1.dprcoin.com';
            }
            if (ip != '0.0.0.0' && ip != '127.0.0.1') {

                var uptime = info.stats ? (info.stats.uptime / 60 / 60 / 24).toFixed(1) : "N/A";
                var fee = (info.fee || 0).toFixed(2);

                str += "<div class='p2p-row "+(row++ & 1 ? "row-grey" : "")+"'><div class='p2p-ip2'><a href='http://"+ip+":6151/static/' target='_blank'>"+ip+":6151</a></div><div class='p2p-fee2'>"+fee+"%</div><div class='p2p-uptime2'>"+uptime+" days</div><div class='p2p-hashrate2'>"+(local_hash_rate/1000000).toFixed(2)+" "+config.speed_abbrev+"</div><div class='p2p-miners2'>"+miner_count+"</div>";
                str += "<div class='p2p-geo2'>";
                if(info.geo) {
                    str += "<a href='http://www.geoiptool.com/en/?IP="+info.ip+"' target='_blank'>"+info.geo.country+" "+"<img src='"+info.geo.img+"' align='absmiddle' border='0'/></a>";
                }
                str += "</div>";
                str += "</div>";
                str += "<br style='clear:both;'/>";
            }
        })
        str += "</div><p/><br/>";
        str += "</body>"
        return str;
    }

    // setup flushing of rendered HTML page to a file (useful for uploading to other sites)
    if(config.flush_to_file_every_N_msec && config.flush_filename) {
        function flush_rendering() {
            var str = self.render();
            fs.writeFile(config.flush_filename, str, { encoding : 'utf8'});
            dpc(config.flush_to_file_every_N_msec, flush_rendering);
        }

        dpc(5000, flush_rendering);
    }

    // defer init
    dpc(function(){
        self.restore_working();
        self.update();
    })

    var p2pool_init = true;

    // main function that reloads 'addr' file from p2pool
    self.update = function() {
        var filename = config.addr_file;
        if(!fs.existsSync(filename)) {
            console.error("Unable to fetch p2pool address list from:",config.addr_file);
            filename = config.init_file;    // if we can't read p2pool's addr file, we just cycle on the local default init...
        }

        fs.readFile(filename, { encoding : 'utf8' }, function(err, data) {
            if(err) {
                console.error(err);
            }
            else {
                try {
                    var addr_list = JSON.parse(data);
                      self.inject(addr_list);

                    // main init
                    if(p2pool_init) {
                        p2pool_init = false;

                        // if we can read p2pool addr file, also add our pre-collected IPs
                        // if(filename != config.init_file) {
                            var init_addr = JSON.parse(fs.readFileSync(config.init_file, 'utf8'));
				self.inject(init_addr);
                        //}

                        for(var i = 0; i < (config.probe_N_IPs_simultaneously || 1); i++)
                            self.digest();
                        dpc(60*1000, function() { self.store_working(); })
                    }
                }
                catch(ex) {
                    console.error("Unable to parse p2pool address list");
                    console.error(ex);
                }
            }

            dpc(1000 * 60, self.update);
        })
    }

    // store public pools in a file that reloads at startup
    self.store_working = function() {
        var data = JSON.stringify(self.addr_working);
        fs.writeFile(config.store_file, data, { encoding : 'utf8' }, function(err) {
            dpc(60*1000, self.store_working);
        })
    }

    // reload public list at startup
    self.restore_working = function() {
        try {
            self.addr_working = JSON.parse(fs.readFileSync(config.store_file, 'utf8'));
        } catch(ex) { /*console.log(ex);*/ }
    }

    // inject new IPs from p2pool addr file
    self.inject = function(addr_list) {
        _.each(addr_list, function(info) {
            var ip = info[0][0];
            var port = info[0][1];
		// Block 127.0.0.1
            if(!self.addr_digested[ip] && !self.addr_pending[ip]) {
                self.addr_pending[ip] = { ip : ip, port : port }
            }
            
            self.nodes_total = _.size(self.addr_digested) + _.size(self.addr_pending);
        });
    }

    // as we scan pools, we fetch global info from them to update the page
    self.update_global_stats = function(poolstats) {
        self.poolstats = poolstats;
    }

    // execute scan of a single IP
    self.digest = function() {

        if(!_.size(self.addr_pending))
            return self.list_complete();

        var info = _.find(self.addr_pending, function() { return true; });
        delete self.addr_pending[info.ip];
        self.addr_digested[info.ip] = info;
        // console.log("P2POOL DIGESTING:",info.ip);

        digest_ip(info, function(err, fee){
            if(!err) {
                info.fee = fee;
                self.addr_working[info.ip] = info;
                // console.log("FOUND WORKING POOL: ", info.ip);

                digest_local_stats(info, function(err, stats) {
                    if(!err)
                        info.stats = stats;
			// NewStats
			info.miner_count = Object.keys(info.stats.miner_hash_rates).length;
			//console.log(info.miner_count);
			info.local_hash_rate = 0;
			_.each(stats.miner_hash_rates, function(key) {
				info.local_hash_rate += key;
			});
			//console.log(info.local_hash_rate);
		 
                    digest_global_stats(info, function(err, stats) {
                        if(!err)
                            self.update_global_stats(stats);

                        if(!info.geo)
                            self.geo.get(info.ip, function(err, geo) {
                                if(!err)
                                    info.geo = geo;

                                continue_digest();
                            });
                        else
                            continue_digest();
                    });
                });
            }
            else {
                delete self.addr_working[info.ip];
                continue_digest();
            }

            function continue_digest() {
                self.working_size = _.size(self.addr_working);
                dpc(self.digest);
            }
        });
    }

    // schedule restar of the scan once all IPs are done
    self.list_complete = function() {
        self.addr_pending = self.addr_digested;
        self.addr_digested = { }
        dpc(config.rescan_list_delay, self.digest);
    }

    // functions to fetch data from target node IP

    function digest_ip(info, callback) {

        var options = {
          host: info.ip,
          port: 6151,
          path: '/fee',
          method: 'GET'
        };

        self.request(options, callback);
    }

    function digest_local_stats(info, callback) {

        var options = {
          host: info.ip,
          port: 6151,
          path: '/local_stats',
          method: 'GET'
        };

        self.request(options, callback);
    }

    function digest_global_stats(info, callback) {

        var options = {
          host: info.ip,
          port: 6151,
          path: '/global_stats',
          method: 'GET'
        };

        self.request(options, callback);
    }

    // make http request to the target node ip
    self.request = function(options, callback, is_plain)
    {
        http_handler = http;
        var req = http_handler.request(options, function(res) {
            res.setEncoding('utf8');
            var result = '';
            res.on('data', function (data) {
                result += data;
            });

            res.on('end', function () {
                if(options.plain)
                    callback(null, result);
                else {
                    try {
                        var o = JSON.parse(result);
                        callback(null, o);
                    } catch(ex) {
                        console.error(ex);
                        callback(ex);
                    }
                }
            });
        });

        req.on('socket', function (socket) {
            socket.setTimeout(config.http_socket_timeout);
            socket.on('timeout', function() {
                req.abort();
            });
        });

        req.on('error', function(e) {
            callback(e);
        });

        req.end();
    }

    if(upload && process.platform != 'win32') {

        function do_upload() {

            if(upload.ftp) {
                var ftp = upload.ftp;
                if(!ftp.address || !ftp.username || !ftp.password)
                    return console.error("upload.cfg ftp configuration must contain target address, username and password");
                var cmd = "curl -T "+config.flush_filename+" "+ftp.address+" --user "+ftp.address+":"+ftp.password;
                exec(cmd, function(error){ if(error) console.error(error); });
            }

            if(upload.scp) {
                var scp = upload.scp;
                if(!scp.address)
                    return console.error("upload.cfg scp configuration must contain target address");
                var cmd = "scp -q ./"+config.flush_filename+" "+scp.address;
                exec(cmd, function(error){ if(error) console.error(error); });
            }

            dpc(config.upload_interval, do_upload);
        }

        dpc(5000, do_upload);
    }
    else
        console.log("upload.cfg not found, rendering available only on the local interface");
}


GLOBAL.scanner = new Scanner();


//
