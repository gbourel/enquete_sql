(function (){
  const VERSION = 'v0.1.3';
  let SQL = null;
  let _db = null;
  let _query = null;  // list of commands

  // highlight command
  function highlightCmd(elt) {
    let highlighted = Array.from(document.querySelectorAll('.current'));
    highlighted.forEach(e => {
      e.classList.remove('current');
    })
    if(elt) {
      elt.classList.add('current');
    }
  }

  // display error msg
  function error(msg) {
    let elt = document.getElementById('error');
    elt.innerText = msg;
    elt.style.display = 'inline-block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('response-msg').style.display = 'none';
  }

  function showRunning() {
    let elt = document.getElementById('run');
    elt.style.display = 'none';
    elt = document.getElementById('running');
    elt.style.display = 'inline-block';
  }
  function showStart() {
    let elt = document.getElementById('running');
    elt.style.display = 'none';
    elt = document.getElementById('run');
    elt.style.display = 'inline-block';
    elt = document.getElementById('error');
    elt.style.display = 'none';
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
        query += child.textContent;
      } else if(child.nodeType === Node.ELEMENT_NODE) {
        if(child.children && child.children.length > 0
           && !(child.children.length === 1
                && child.children[0].nodeName === 'BR')) {
          query += ' ' + getQuery(child) + ' ';
        } else {
          // skips BR tags
          if(child.nodeName !== 'BR'){
            query += ' ' + child.innerText + ' ';
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
      cntcell.innerText = 'Nombre de lignes trouvés: ' + r.values.length;
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
    }
  }

  // run query
  function start() {
    let editor = document.getElementById("editor")
    let nodes = [];
    let query = getQuery(editor);
    let results = null;
    try {
      results = _db.exec(query);
      showResults(results, query);
    } catch(err) {
      error(err + '\n\nDans la requête: \n' + query);
    }
  }

  // When DB is completly loaded
  function loaded() {
    document.getElementById('run').style.display = 'inline-block';
    document.getElementById('response-msg').innerText = 'Aucun résultat.';
    start();
  }

  // Initialize DB
  function init() {
    initSqlJs({
      locateFile: file => `lib/${file}`
    }).then(res => {
      SQL = res;
      const dbdata = localStorage.getItem('etab.db');
      if(dbdata) {
        const buf = base64ToArrayBuffer(dbdata);
        _db = new SQL.Database(new Uint8Array(buf));
        loaded();
      } else {
        // load database from remote file
        console.info('Fetch database...');
        fetch("etab.db")  .then(res => {
          console.info('Fetch ok.');
          res.arrayBuffer().then(buf => {
            console.info('Cache and load DB.');
            localStorage.setItem('etab.db', arrayBufferToBase64(buf));
            _db = new SQL.Database(new Uint8Array(buf));
            loaded();
          })
        });
      }
    });
  }

  // run command on CTRL + Enter shorcut
  document.addEventListener('keyup', evt => {
    if(evt.srcElement && evt.srcElement.id === 'editor'
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
      document.getElementById('editor').innerHTML = '<div>' + q + '</div>';
    }
  }

  window.queryStart = start;

  init();
})();