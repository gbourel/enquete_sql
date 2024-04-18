(function (){
  const VERSION = 'v0.3.0';
  let SQL = null;
  let _db = null;
  let _query = null;  // list of commands

  const config = {
    log: () => {},

    debug: false,
    activity: 1,
    db: 'etab.db'
  };

  // display error msg
  function error(msg) {
    let elt = document.getElementById('error');
    elt.innerText = msg;
    elt.style.display = 'inline-block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('response-msg').style.display = 'none';
  }

  function arrayBufferToBase64( buffer ) {
    let binary = '';
    let bytes = new Uint8Array( buffer );
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
  }
  function base64ToArrayBuffer(base64) {
    var binary_string =  window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array( len );
    for (var i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // recursively append children to nodes array
  function getQuery(elt){
    let query = '';
    for(const child of elt.childNodes) {
      // get text nodes content
      if(child.nodeType === Node.TEXT_NODE) {
        if(child.textContent) {
          query += child.textContent.trim();
        }
      } else if(child.nodeType === Node.ELEMENT_NODE) {
        if(child.children && child.children.length > 0
           && !(child.children.length === 1
                && child.children[0].nodeName === 'BR')) {
          query += ' ' + getQuery(child) + ' ';
        } else {
          // skips BR tags
          if(child.nodeName !== 'BR'){
            if(child.innerText) {
              let text = child.innerText.replace(/\s+/g, ' ')
              query += ' ' + text.trim() + ' ';
            }
          }
        }
      } else {
        console.warn('Unknown node type', child);
      }
    }
    return query;
  }

  // Display results as table
  function showResults(results, query) {
    const table = document.getElementById('results');
    const msg = document.getElementById('response-msg');
    if(results && results[0]) {
      let r = results[0];
      table.innerHTML = '';
      let count = document.createElement("tr");
      let cntcell = document.createElement("th");
      cntcell.setAttribute('class', 'count');
      cntcell.setAttribute('colspan', r.columns.length);
      cntcell.innerText = 'Nombre de lignes trouvées: ' + r.values.length;
      count.appendChild(cntcell);
      table.appendChild(count);
      let head = document.createElement("tr");
      r.columns.forEach(col => {
        let cell = document.createElement("th");
        cell.innerText = col;
        head.appendChild(cell);
      });
      table.appendChild(head);
      r.values.forEach(v => {
        let row = document.createElement("tr");
        v.forEach(c => {
          let cell = document.createElement("td");
          cell.innerText = c;
          row.appendChild(cell);
        })
        table.appendChild(row);
      });
      msg.style.display = 'none';
      table.style.display = 'table';
      document.getElementById('error').style.display = 'none';
    } else {
      console.info('Unknown result', results);
      table.style.display = 'none';
      table.innerHTML = '';
      msg.style.display = 'inline-block';
      msg.innerText = 'Aucun résultat pour la requête:\n ' + query;
      document.getElementById('error').style.display = 'none';
    }
  }

  // run query
  function start() {
    let editor = document.getElementById("editor")
    let nodes = [];
    let query = getQuery(editor);
    localStorage.setItem('last_query', query);
    let results = null;
    try {
      console.info('Query:', query);
      results = _db.exec(query);
      showResults(results, query);
    } catch(err) {
      error(err + '\n\nDans la requête: \n' + query);
    }
  }

  // When DB is completly loaded
  function loaded() {
    document.getElementById('run').style.display = 'inline-block';
    document.getElementById('response-msg').innerText = "En attente de l'exécution d'une requête";
    // start();
  }

  // Initialize DB
  function init() {
    // Load parameters from url search infos
    const options = {
      debug: 'bool',
      activity: 'int'
    }
    let search = window.location.search;
    if(search && search.length > 0) {
      let vars = search.substring(1).split("&");
      for (let v of vars) {
        let pair = v.split("=");
        if(!(pair[0] in options)) {
          console.warn('Unknown option:', pair[0]);
          continue;
        }
        if (options[pair[0]] === 'bool') {
          config[pair[0]] = true;
        } else if (options[pair[0]] === 'int') {
          config[pair[0]] = parseInt(pair[1]);
        } else {
          config[pair[0]] = pair[1];
        }
      }
    }
    if (config.activity === 2) {
      config.db = 'liner.db';
      let curQuery = '-- Les requêtes SQL peuvent être écrites ici.';
      const last = localStorage.getItem('last_query');
      if (last) {
        curQuery = last;
      }
      document.querySelector('body').classList.add('liner');
      document.querySelector('#editor div').innerHTML = curQuery;
      document.querySelector('header h2').innerHTML = 'Base de données pour les questions de <a href="https://nsix.fr">nsix.fr</a> code <strong>UHPMJT</strong>.';
    }

    initSqlJs({
      locateFile: file => `lib/${file}`
    }).then(res => {
      SQL = res;
      const dbdata = null; //localStorage.getItem(config.db);
      if(dbdata) {
        const buf = base64ToArrayBuffer(dbdata);
        _db = new SQL.Database(new Uint8Array(buf));
        loaded();
      } else {
        // load database from remote file
        console.info('Fetch database...');
        fetch(config.db).then(res => {
          console.info('Fetch ok.');
          res.arrayBuffer().then(buf => {
            console.info('Cache and load DB.', config.db);
            localStorage.setItem(config.db, arrayBufferToBase64(buf));
            _db = new SQL.Database(new Uint8Array(buf));
            loaded();
          })
        });
      }
    });
  }

  // run command on CTRL + Enter shortcut
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.id === 'editor'
       && evt.key === 'Enter'
       && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
      start();
    }
  });
  document.getElementById('version').textContent = VERSION;

  let purl = new URL(window.location.href);
  if(purl && purl.searchParams) {
    let q = purl.searchParams.get("query");
    if(q && q.length) {
      // kludge to handle invalid url with bad escaping for double quotes
      q = q.replaceAll("%22", "\"")
      document.getElementById('editor').innerHTML = '<div>' + q + '</div>';
    }
  }

  // Page view counter
  // fetch('https://hitcounter.ileauxsciences.fr/hit/', {
  //   method: 'POST' });

  window.queryStart = start;

  init();
})();