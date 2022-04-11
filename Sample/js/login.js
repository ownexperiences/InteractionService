// this is the id of the form

$(document).ready(function(){
  localStorage.clear();
  navigator.mediaDevices.getUserMedia({ audio: true });
  navigator.geolocation.getCurrentPosition(function(){});
  
});


$("#loginFrm").submit(async function(e) {
  
  e.preventDefault(); // avoid to execute the actual submit of the form.

  const userId = $("#user_id").val();
  
  $("#loading").show();

  try {
    InteractionServices.ApiKey = "bc95971a8172423e";
    InteractionServices.ApiSecret = "894cc0fa6fbd4beb";
    InteractionServices.TenantName = "spotify";
    InteractionServices.UserId = userId;
    const result = await InteractionServices.init();
    console.log(result)
    $('.register p').remove();
    $("#loading").show();
    if (result.success) {
      console.log(result.success);
      window.location.href = './app.html';
    }
  } catch (error) {
    console.log($('.register p'))
    if (!$('.register p').length) $('.register').append('<p style="color: red">' + error.message + '</p>')
    $("#loading").show();
  }
});