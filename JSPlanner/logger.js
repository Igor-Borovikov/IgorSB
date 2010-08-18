function logger(msg, tabs, newLines){
    var n; // tabs and line breaks counter
    var elem = document.getElementById('logger');
    if (!elem){
        elem = document.createElement('div');
        elem.id = "logger";
        var doc = document.getElementsByTagName('body')[0];
        doc.appendChild(elem);
    };

    for (n=0; n<newLines; n++){
        elem.innerHTML += '<br>';
    };
    
    for (n = 0; n<tabs; n++){
        elem.innerHTML += '&nbsp';
    }
    
    elem.innerHTML += msg;
};