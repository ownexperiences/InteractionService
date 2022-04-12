if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker
      .register("/serviceWorker.js")
      .then(res => console.log("service worker registered"))
      .catch(err => console.log("service worker not registered", err));
  });
}

$(document).ready(function(){    
  if(localStorage.getItem("logged_in_user") == null)
    window.location.href = "index.html";

    InteractionServices.Action_QuestionCallback = (response)=>{InteractionServices.TextToSpeech(response.result.content_value)}
    InteractionServices.Action_StatementCallback = (response)=>{InteractionServices.TextToSpeech(response.result.content_value)}
});

$(".tabToRecord").on("mousedown",function(){
  if(!InteractionServices.isRecording && !InteractionServices.isTalking && !InteractionServices.isUploading){
    InteractionServices.startRecording();    
  }
});

$(".tabToRecord").on("mouseup",function(){
  if(InteractionServices.isRecording){
    //mediaRecorder.stop();
    InteractionServices.stopRecording();
  }
});

//--------- App Start
function start(){
  navigator.mediaDevices.getUserMedia({ audio: true });
  navigator.permissions.query(
      { name: 'microphone' }
  ).then(function(permissionStatus){
      if(permissionStatus.state == "granted") {
        navigator.permissions.query(
          { name: 'geolocation' }
        ).then(function(permissionStatus){
            if(permissionStatus.state == "granted"){
              $(".chatbot").on("touchstart", function(e) {
                if(!InteractionServices.isRecording && !InteractionServices.isTalking && !InteractionServices.isUploading){
                  InteractionServices.startRecording();
                }
              });
              $(".chatbot").on("touchend", function(e) {
                if(InteractionServices.isRecording){
                  InteractionServices.stopRecording();
                  $(".tabToRecord").css("opacity","1");
                }
              });
              InteractionServices.connect({ onChange: InteractionServices.printHeartRate }).catch(console.error);
            } else{
              alert("Grant Geolocation access please.")
            } 
        })
      } else{
        alert("Grant Microphone access please.")
      }
  })
}
