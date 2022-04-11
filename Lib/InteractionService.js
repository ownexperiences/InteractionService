
const InteractionServices = (function (window, _) { 

  var api_url="https://api.ownexperiences.com";

  const InteractionServices = {};

  /// ---- User Predefined Values
  //------ You should fill those values before start using any of below functions
  InteractionServices.ApiKey = "";
  InteractionServices.ApiSecret = "";
  InteractionServices.TenantName = "";
  InteractionServices.UserId = "";

  InteractionServices.init = async function() {
    return new Promise((resolve, reject) => {
      var settings = {
        "url": api_url + "/api/TokenAuth/Auth",
        "method": "POST",
        "timeout": 0,
        "headers": {
          "Content-Type": "application/json"
        },
        "data": JSON.stringify({
          "apiKey": InteractionServices.ApiKey,
          "apiSecret": InteractionServices.ApiSecret,
          "tenantName": InteractionServices.TenantName
        }),
        "error": function(error) {
          reject({ success: false, message: error.responseJSON.error.details }); 
        }
      };
      $.ajax(settings).done(function (response) {
        var Token = response.result.accessToken;
        localStorage.setItem('token', Token);
        var settings2 = {
          "url": api_url + "/api/services/app/State/GetUserPreferences?userID=" + InteractionServices.UserId,
          "method": "GET",
          "timeout": 0,
          "headers": {
            "Content-Type": "application/json",
            "Authorization":"Bearer "+ Token
          },"error": function (xhr, ajaxOptions, thrownError) {
            alert("error occurred while trying to log you in");
            reject({ success: false, message: "Something went wrong in the process to get user detail" });
          }
        }

        $.ajax(settings2).done(function (resp) {
          console.log(resp)
          localStorage.setItem("logged_in_user", InteractionServices.UserId);              
          localStorage.setItem("user_recurring",resp.result.recurring_user);
          localStorage.setItem("user_basalBpm",resp.result.basal_bpm);
          localStorage.setItem("user_userProfile",resp.result.user_profile);
          resolve({ success: true });
        });
  
      });
    });
  }

  //------- global variables

  let hrData = new Array(200).fill(10)
  let RealtimeHeartRate =0;
  var latitude = "";
  var longitude = "";
  var currentSpeed=0;
  var mediaRecorder;
  var uncertaintyDetected=0;
  InteractionServices.isRecording=false;
  InteractionServices.isTalking=false;
  InteractionServices.isUploading=false;
  var isTesting=false;
  var PassiveModeOn=false;

  //webkitURL is deprecated but nevertheless
  URL = window.URL || window.webkitURL;

  var gumStream; 						//stream from getUserMedia()
  var rec; 							//Recorder.js object
  var input; 							//MediaStreamAudioSourceNode we'll be recording
  var IsVoiceActivated =false;
  var VoiceActivationTimeout;

  // shim for AudioContext when it's not avb. 
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var audioContext //audio context to help us record

  let artyom = new Artyom();

  // Or add multiple commands at time
  var myGroup = [
    {
        //smart:true, 
        indexes:["hi","hey","hello","I hate this song","I love this song","i love this","i hate this"],
        action:function(i){ // var i returns the index of the recognized command in the previous array
          debugger;
          if(i <= 2){
            IsVoiceActivated=true;
            clearInterval(VoiceActivationTimeout);
            //artyom.say("I can hear you now !");
            
            $(".tabToRecord").hide();

            InteractionServices.startRecording();          

            VoiceActivationTimeout = setTimeout(() => {
              IsVoiceActivated=false;
              $(".tabToRecord").show();  

              //artyom.say("you didn't say anything.");
              InteractionServices.stopRecording();
            }, 7000);

            startContinuousArtyom();
          }else{
            if(IsVoiceActivated){
              IsVoiceActivated=false;
              $(".tabToRecord").show();  
              
              clearInterval(VoiceActivationTimeout);            
              InteractionServices.stopRecording();

            }
          }
        }
    }
  ];

  artyom.addCommands(myGroup); 

  InteractionServices.TextToSpeach = (Text) => {
    artyom.say(Text,{
      onStart:function(){
        InteractionServices.onPlaying();
      },
      onEnd:function(){
        InteractionServices.onStop();
      }
    });
  }
  // This function activates artyom and will listen all that you say forever (requires https conection, otherwise a dialog will request if you allow the use of the microphone)
  const startContinuousArtyom = () => {
    artyom.fatality();// use this to stop any of

    setTimeout(function(){// if you use artyom.fatality , wait 250 ms to initialize again.
        artyom.initialize({
            lang:"en-GB",// A lot of languages are supported. Read the docs !
            continuous:false,// Artyom will listen forever
            listen:true, // Start recognizing
            debug:true, // Show everything in the console
            speed:1, // talk normally
            voice: ['Google US English', 'Alex'],
        }).then(function(){
            console.log("Ready to work !");
            $("#Passive_mode").show();
        });
    },250);
  }

  InteractionServices.onPlaying = () => {
    InteractionServices.isTalking=true;
    $(".tabToRecord").hide();
    $(".audioWrapper .loader").removeClass("idle").removeClass("listening");
    InteractionServices.isUploading=false;
  }

  InteractionServices.onStop = () => {
    InteractionServices.isTalking=false;
    $(".tabToRecord").show();
    $(".audioWrapper .loader").addClass("idle").removeClass("listening");

    if(PassiveModeOn){
      navigator.permissions.query(
        { name: 'microphone' }
        ).then(function(permissionStatus){
          $("#Passive_mode").show();
          startContinuousArtyom();
        }
      );
    }
  }

  InteractionServices.connect = async (props) => {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate',] }],
      acceptAllDevices: false,
    })

    const server = await device.gatt.connect()
    const service = await server.getPrimaryService('heart_rate')
    const char = await service.getCharacteristic('heart_rate_measurement')

    device.addEventListener('gattserverdisconnected', onDisconnected);

    char.oncharacteristicvaluechanged = props.onChange
    char.startNotifications();

    PlayCarl();


    return char
  }   

  InteractionServices.printHeartRate = (event) => {
    RealtimeHeartRate = event.target.value.getInt8(1)

    //check if hearRate triggered the passive mode
    
    const prev = hrData[hrData.length - 1]
    hrData[hrData.length] = RealtimeHeartRate
    hrData = hrData.slice(-200)
    let arrow = ''
    if (RealtimeHeartRate !== prev) arrow = RealtimeHeartRate > prev ? '⬆' : '⬇'
    document.getElementById("hr-rate").innerHTML = `<img src="./images/heart.png" width="16"> ${RealtimeHeartRate} ${arrow}`;
  }

  const onDisconnected = (event) => {
    const device = event.target;
    console.log(`Device ${device.name} is disconnected.`);
  }
  
  const recorder = new MicRecorder({
    bitRate: 512
  });

  InteractionServices.startRecording = () => {
    InteractionServices.isRecording=true;
    recorder.start().then(() => {
      $(".tabToRecord").css("opacity","0.3");
      console.log("---- recording started");
      $(".audioWrapper .loader").removeClass("idle").addClass("listening");
    }).catch((e) => {
      console.error(e);
    });
  }

  InteractionServices.stopRecording = (sendToCloud=true) => {
    InteractionServices.isRecording=false;
    $(".tabToRecord").css("opacity","1");
    recorder.stop().getMp3().then(([buffer, blob]) => {
      $(".audioWrapper .loader").removeClass("listening").addClass("idle");
      if(sendToCloud)
        SendTheRecordToCloud(blob);
    }).catch((e) => {
      console.error(e);
    });
  }

  const SendTheRecordToCloud = (blob) => {	
    InteractionServices.isUploading=true;
    var form = new FormData();
    form.append("isVoicePreseted", true);
    form.append("Response_Voice_Wav", blob, "input.wav");
    form.append("Beats_Per_Minute", RealtimeHeartRate);
    form.append("Time_Taken_To_Response", "1");
    form.append("Interaction_Session", localStorage.getItem("interaction_session"));
    form.append("IsTesting", isTesting);
    
    const payloadArray = [];  
    var recurringUser = localStorage.getItem("user_recurring");

    payloadArray.push({"name":"RecurringUser","value": recurringUser});
    payloadArray.push({"name":"spotify_playlist","value": localStorage.getItem("spotify_playlistid")});
    payloadArray.push({"name":"spotify_user","value": localStorage.getItem("spotify_userid")});
    payloadArray.push({"name":"spotify_top10songs","value": localStorage.getItem("spotify_top10songs") ? JSON.stringify(localStorage.getItem("spotify_top10songs").split(',')) : localStorage.getItem("spotify_top10songs")});
    payloadArray.push({"name":"spotify_currentPlayingUri","value": ""});  

    form.append("JsonPayload",JSON.stringify(payloadArray));

    var settings = {
      "url": api_url + "/api/Interaction/Interact",
      "method": "POST",
      "timeout": 0,
      "processData": false,
      "mimeType": "multipart/form-data",
      "contentType": false,
      "data": form,
      "dataType":"json",
      "beforeSend":function(){
        $(".tabToRecord").hide();
      },"error":function(data){      
        InteractionServices.TextToSpeach("I didn't hear that can you repeat");
        $(".tabToRecord").show();
      }
    };
    
    $.ajax(settings).done(function (response) {    
      
      if(response.result.stage >= 13){
        // Start listening. You can call this here, or attach this call to an event, button, etc.
        console.log("---- listening started");
        PassiveModeOn=true;
      }
      if(!response.result.statement){
        InteractionServices.TextToSpeach("I didn't hear that can you repeat");
        $(".tabToRecord").show();
      }else{
        InteractionServices.TextToSpeach(response.result.statement); 
      }
    });
  }

  const PlayCarl = () => {

    var Token = localStorage.getItem('token');

    var settings = {
      "url": api_url + "/api/Interaction/SDK_InitializeSession",
      "method": "POST",
      "timeout": 0,
      "headers": {
        "Authorization": "Bearer " + Token,
        "Content-Type": "application/json"
      },
      "data": JSON.stringify({
        "UserID": localStorage.getItem("logged_in_user")
      }),
      "beforeSend" : function(){
        $("#loading").show();          
      },
      "error": function (xhr, ajaxOptions, thrownError) {
        $("#loading").hide();
      }
    };
    
    $.ajax(settings).done(function (response) {
      $("#loading").hide();
      $(".wrapper").show();
      
      if(response.success){
        console.log(response);
        localStorage.setItem("interaction_session",response.result.id);

        InteractionServices.TextToSpeach("Hello, My Name Is Carl");
      }
    });

    $(".section1").hide();
    $(".section2").show();

  }

  //------------ Background worker.


  ///------------ Stop Watch ---
  //----------------------------

  var stopWatchPlaying=false;
  var StopWatch_Seconds = 00; 
  var StopWatch_tens = 00; 
  var StopWatch_interval;

  InteractionServices.StopWatch_Start = () => {
    stopWatchPlaying=true;
    console.log("---timer started");
    clearInterval(StopWatch_interval);
      StopWatch_interval = setInterval(startTimer, 10);
  }

  InteractionServices.StopWatch_Stop = () => {
    stopWatchPlaying=false;
    console.log("---timer stopped");
    clearInterval(StopWatch_interval);
  }

  InteractionServices.StopWatch_Reset = () => {
    stopWatchPlaying=false;
    console.log("---timer reset");
      clearInterval(StopWatch_interval);
    StopWatch_tens = "00";
    StopWatch_Seconds = "00";
  }
    
  InteractionServices.startTimer = () => {

    console.log("---timer ticks :"+StopWatch_Seconds);

    StopWatch_tens++;   
    
    if (StopWatch_tens > 99) {    
      StopWatch_Seconds++;
      StopWatch_tens = 0;
    }
  }
  return InteractionServices;
}(window));
