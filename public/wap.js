// Hardcoded data
const accessoriesData = [
    {
      "Accesories": "WAP",
      "Validdisposition": "PASS-FUNCTIONAL",
      "listofcomponents": ["ENDCAP","POWER SUPPLY","ETHERNET CABLE", "IMPORTANT PRODUCT INFORMATION"]
    },
    {
      "Accesories": "WAP2.0",
      "Validdisposition": "PASS-FUNCTIONAL",
      "listofcomponents": ["ENDCAP","POWER SUPPLY","ETHERNET CABLE", "IMPORTANT PRODUCT INFORMATION"]
    },
    {
      "Accesories": "WAP1.0",
      "Validdisposition": "PASS-FUNCTIONAL",
      "listofcomponents": ["ENDCAP","POWER SUPPLY","ETHERNET CABLE", "IMPORTANT PRODUCT INFORMATION"]
    }
  ];
  
  // Function to get accessory data based on accessory name
  function getAccessoryData(accessory) {
    return accessoriesData.find(data => data.Accesories === accessory);
  }
  
  $(document).ready(function() {
    var componentsClicked = [];

    $('#accessory').on('keypress', function(e) {
        if(e.which == 13) {  // Check if the key pressed was "Enter" key, ASCII value is 13
          $('#check').click(); // Simulate a click on the Check button
          e.preventDefault();  // Prevent the default action of the "Enter" key
        }
      });

    $('#check').click(function() {
      let accessory = $('#accessory').val();
      console.log('Requesting data for serial:', accessory); // Log the requested serial
      $('#message').text('');
      $.ajax({
          url: '/api/wap/GetWAPStatus',
          type: 'POST',
          data: { serial: accessory },
          success: function(result) {
              console.log('Received data:', result); // Log the received data
              console.log('Raw result:', result);  // Log the raw result
              result = JSON.parse(result);  // Parse the result
              console.log('Parsed result:', result); // Log the parsed result
              // Get the first record from the recordset
              let record = result.recordset[0];
  
              // If the response is empty, set the message as "Receiver info not found."
              if (!record) {
                $('#message').text('Receiver info not found.');
                return;
              }
  
              // Get the matching accessory data from accessoriesData
              let matchingData = getAccessoryData(record.Model);
              // Check if the record's disposition and the matching data's disposition are both "PASS-FUNCTIONAL"
              if (record.Disposition === "PASS-FUNCTIONAL" && matchingData && matchingData.Validdisposition === "PASS-FUNCTIONAL") {
                  // Clear components section before displaying new ones
                  $('#components').empty();
                  componentsClicked = []; // reset components clicked when new accessory is checked
                  $('#confirm').hide(); // hide confirm button when new accessory is checked
                  matchingData.listofcomponents.forEach(function(component) {
                      // Create button for each component
                      let button = $('<button/>', {
                          text: component, 
                          class: 'component-btn'
                      });
                  
                      // Attach click event to button
                      button.click(function() { 
                          componentsClicked.push(component);
                          // Disable button after click
                          $(this).prop('disabled', true);
                          // Change button color to green after click
                          $(this).css('background-color', 'green');
                          if(componentsClicked.length === matchingData.listofcomponents.length) {
                              $('#confirm').show();
                          }
                      });
                  
                      // Append button to components div
                      $('#components').append(button);
                  });
              } else {
                  // If disposition is not "PASS-FUNCTIONAL", set the message as "Receiver in: " + disposition
                  $('#message').text('Receiver in: ' + record.Disposition);
              }
          },
          error: function(jqXHR, textStatus, errorThrown) {
              console.error('API request error:', errorThrown); // Log the API request error
          }
      });
    });
  
    $('#confirm').click(function() {
      // Logic for confirm action
      alert('All components verified.');
      location.reload(); // Refresh page
    });
  });
  
  document.addEventListener('DOMContentLoaded', function() {
    // Send a GET request to the /ntlogin route to get the NT login
    fetch('/ntlogin')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        const windowsUsername = data.windows_username;
        console.log('NT Login:', windowsUsername);
  
        // Set the NT login in the global variable ntLoginData
        ntLoginData = windowsUsername;
        
        // Set the NT login in the placeholder span element
        const ntLoginPlaceholder = document.getElementById('ntLoginPlaceholder');
        ntLoginPlaceholder.textContent = ntLoginData;
      })
      .catch(error => {
        console.error('Error:', error);
      });
  });
  
  