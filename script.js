window.addEventListener('DOMContentLoaded', () => {

  const selectButton = document.getElementById('selectButton');
  const itemList = document.getElementById('listItems');
  const completedListItems = document.getElementById('completedListItems');
  var disable = false;

  const items = [];
  const completeItems = [];
  const filesToConvert = [];

  function obj(name, size, link) {
    this.fileName = name;
    this.fileSize = size;
    this.downLink = link;
  }
  selectButton.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.wav';
    fileInput.click();

    fileInput.addEventListener('change', () => {
      const selectedFiles = fileInput.files;

      function updateItemList() {
        itemList.innerHTML = '';

        items.forEach((item, index) => {
          const li = document.createElement('li');

          const fileText = document.createElement('span');
          fileText.textContent = item.fileName;
          li.appendChild(fileText);

          const fileLargeness = document.createElement('span');
          fileLargeness.textContent = item.fileSize;
          fileLargeness.classList.add('file-size');
          li.appendChild(fileLargeness);

          const fileStatus = document.createElement('span');
          fileStatus.textContent = "";
          fileStatus.classList.add('file-size');
          li.appendChild(fileStatus);

          const removeButton = document.createElement('button');
          removeButton.classList.add("removeButtonStyle");
          removeButton.textContent = 'Remove';
          removeButton.addEventListener('click', () => {
            removeItem(index);
          });
          li.appendChild(removeButton);
          if (disable == true) {
            removeButton.disabled = true;
          }
          itemList.appendChild(li);
        });
      }

      function removeItem(index) {
        items.splice(index, 1);
        filesToConvert.splice(index, 1);
        updateItemList();
        checkArrayEmpty();
      }

      updateItemList();

      function addItem(item) {
        items.push(item);
        updateItemList();
        checkArrayEmpty();
      }

      function addFile(file) {
        filesToConvert.push(file);
      }

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const size = file.size;
        const newSize = size / 1000;

        // add object to add item
        let thing = new obj(file.name, newSize.toFixed() + 'KB');
        addItem(thing);

        // add file to the files to convert
        addFile(file);
      }

    });
  });

  const beginButton = document.getElementById('beginButton');
  const theText = document.getElementById('noFilesText');

  

  function checkArrayEmpty() {
    if (items.length === 0) {
      beginButton.classList.add('disabled');
      theText.style.display = "block";
    } else {
      beginButton.classList.remove('disabled');
      beginButton.disabled = false;
      theText.style.display = "none";
    }
  }

  checkArrayEmpty();

  //MARK: REFRESH BUTTON
  const refreshButton = document.getElementById('refreshButton')

  refreshButton.style.display = 'none';

  refreshButton.addEventListener('click', () => {
    location.reload();
  })


  const status = document.getElementById('statusId');
  status.style.display = 'none'

  //MARK: BEGIN BUTTON
  beginButton.addEventListener('click', () => {

    beginButton.textContent = "Converting Files...";
    beginButton.classList.add('disabled');
    selectButton.classList.add('disabled');

    status.style.display = 'block'

    loadLameJs(function () {
      convertFiles(filesToConvert)
    })

  });

  //MARK: CONVERT LOGIC
  async function convertFiles(files) {
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await Convert(files[i]);
        files[i].downLink = url
        console.log('Converted file URL:', url);


        // download all button
        const downloadButton = document.getElementById('downloadAllButton');

        downloadButton.addEventListener('click', () => {
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          ogName = files[i].name;
          downloadLink.download = ogName.substring(0, ogName.length - 3) + '.mp3';
  
          console.log(downloadLink)
  
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        })
      } catch (error) {
        console.error('Error converting ' + files[i] + ': ', error);
        // Handle the error as needed
      }
    }

    // All conversions are completed here
    refreshButton.style.display = 'block'

    console.log('All files converted');
    beginButton.style.display = "none";
    selectButton.classList.remove('disabled');

  

    updateMp3Side(completeItems)


  }

  function Convert(file) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = function () {
        const arrayBuffer = this.result;

        var dataView = new DataView(arrayBuffer);
        var wav = lamejs.WavHeader.readHeader(dataView);
        console.log('Channels:', wav.channels);
        console.log('Sample Rate:', wav.sampleRate);
        console.log('Data Offset:', wav.dataOffset);
        console.log('Data Length:', wav.dataLen);

        const samples = new Int16Array(arrayBuffer, wav.dataOffset, wav.dataLen / 2);
        const buffer = [];
        const mp3enc = new lamejs.Mp3Encoder(wav.channels, wav.sampleRate, 128);
        var remaining = samples.length;
        var maxSamples = 1152;
        var left = new Int16Array(arrayBuffer, wav.dataOffset, wav.dataLen / 2);
        var right = new Int16Array(arrayBuffer, wav.dataOffset, wav.dataLen / 2);

        if (wav.channels === 1) {
          for (var i = 0; remaining >= maxSamples; i += maxSamples) {
            var mono = samples.subarray(i, i + maxSamples);
            var mp3buf = mp3enc.encodeBuffer(mono);
            if (mp3buf.length > 0) {
              buffer.push(new Int8Array(mp3buf));
            }
            remaining -= maxSamples;
          }
        } else if (wav.channels === 2) {
          var left = new Int16Array(samples.length / 2);
          var right = new Int16Array(samples.length / 2);
          for (var i = 0; i < samples.length; i += 2) {
            left[i / 2] = samples[i];
            right[i / 2] = samples[i + 1];
          }

          for (var i = 0; remaining >= maxSamples; i += maxSamples) {
            var leftChunk = left.subarray(i, i + maxSamples);
            var rightChunk = right.subarray(i, i + maxSamples);
            var mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
              buffer.push(new Int8Array(mp3buf));
            }
            remaining -= maxSamples;
          }
        }

        var d = mp3enc.flush();
        if (d.length > 0) {
          buffer.push(new Int8Array(d));
        }

        console.log('done encoding, size=', buffer.length);
        var blob = new Blob(buffer, { type: 'audio/mp3' });
        var compFile = new File(buffer, file.name.substring(0, file.name.length - 4) + '.mp3', { type: 'audio/mp3' })
        console.log(compFile)

        const size = compFile.size / 3;

        var url = URL.createObjectURL(blob);

        const completeFileObject = new obj(compFile.name, size.toFixed() + "KB", url)
        addToComplete(completeFileObject); 

        
        resolve(url);
        console.log(blob)
        updateProgress();
      };

      function addToComplete(file) {
        completeItems.push(file)
      }



      fileReader.onerror = function () {
        reject(new Error('File reading error'));
      };

      fileReader.readAsArrayBuffer(file);
    });
  }

  //update percentage
  function updateProgress() {
    const percent = Math.floor((completeItems.length / filesToConvert.length) * 100);

    status.textContent = percent + '% complete.';
  }


  function loadLameJs(callback) {
    if (typeof lamejs !== 'undefined') {
      console.log("LameJS is already loaded and ready for use")
      callback();
    } else {
      console.log("LameJs has not yet been loaded, doing so now...")
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.all.min.js'
      script.onload = callback
      script.onerror = function () {
        console.log('ERROR while loading lameJs library')
      }
      document.head.appendChild(script)
      console.log("Finished Loading Lamejs")
    }
  }



  //MARK: SEND CONVERTED FILES TO MP3 SIDE
  function updateMp3Side(files) {

    const noCompFiles = document.getElementById('noCompFilesText')
    if (completeItems.length > 0) {
      noCompFiles.style.display = 'none'
    }

    completedListItems.innerHTML = '';

    files.forEach((item) => {

      const li = document.createElement('li');

      const fileText = document.createElement('span');
      fileText.textContent = item.fileName;
      li.appendChild(fileText);

      const fileLargeness = document.createElement('span');
      fileLargeness.textContent = item.fileSize;
      fileLargeness.classList.add('file-size');
      li.appendChild(fileLargeness);

      const fileStatus = document.createElement('span');
      fileStatus.textContent = "";
      fileStatus.classList.add('file-size');
      li.appendChild(fileStatus);

      const downloadOne = document.createElement('button');

      const icon = document.createElement('i');
      icon.classList.add('fas', 'fa-download')

      downloadOne.appendChild(icon);

      // download individual
      downloadOne.addEventListener('click', () => {
        const url = item.downLink;

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        var ogName = item.fileName;
        downloadLink.download = ogName.substring(0, ogName.length - 3) + '.mp3';
  
        console.log(downloadLink)
  
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      });

      li.appendChild(downloadOne);
      if (disable == true) {
        downloadOne.disabled = true;
      }
      completedListItems.appendChild(li);
    });
  }

  const signInBtn = document.getElementById("signInButton");
  const dismiss = document.getElementById("overlay");

  signInBtn.addEventListener('click', () => {
    showSignIn();
  })

  dismiss.addEventListener('click', () => {
    dismissSignIn();
  })


  function showSignIn() {
    document.getElementById("overlay").style.display = "block"
  }

  function dismissSignIn() {
    document.getElementById("overlay").style.display = "none";
  }

});


