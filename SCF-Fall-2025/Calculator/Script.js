// ========================================
//           JAVASCRIPT FORM SECTION
// ========================================

// Get a reference to the submit button
const submitButton = document.getElementById('NameSubmit');

// Add an event listener for the 'click' event
submitButton.addEventListener('click', function(event) {
    // Prevent the default form submission behavior
    event.preventDefault();
    
    // Call the function to display motivational quote
    sayName();
});

function sayName() {
    // Get the name from the input field
    let name = document.getElementById("Name").value;
    
    // Display the name in the message box
    document.getElementById("nameMessage").textContent = name;
}

// CALCULATOR SECTION //           

// Get references to calculator elements
const addButton = document.getElementById("AddTwoNumbers");
const xField = document.getElementById("X");
const operator = document.getElementById("Operator");
const yField = document.getElementById("Y");
const resultBox = document.getElementById("resultBox");

// Add event listener for calculator button
addButton.addEventListener('click', function(event) {
    // Prevent default behavior
    event.preventDefault();
    
    // Get values from inputs
    let x = parseInt(xField.value);
    let y = parseInt(yField.value);
    let op = operator.value;
    
    // Perform calculation
    let result = DoMath(x, y, op);
    
    // Display result in the result box
    resultBox.innerHTML = x + " " + op + " " + y + " = " + result;
});

// Function to perform mathematical operations
function DoMath(x, y, operator) {
    // Check if the operator is addition
    if (operator === '+') {
        return x + y;
    } 
    // Check if the operator is subtraction
    else if (operator === '-') {
        return x - y;
    } 
    // Check if the operator is multiplication
    else if (operator === '*') {
        return x * y;
    } 
    // Check if the operator is division
    else if (operator === '/') {
        // Make sure we don't divide by zero
        if (y !== 0) {
            return x / y;
        } else {
            return "Cannot divide by zero";
        }
    } 
    // If none of the above operators match
    else {
        return "Invalid operator";
    }
}

// Simple addition function (currently unused)
function AddTwoNumbers(x, y) {
    // Add the two numbers together
    let result = x + y;
    // Return the result
    return result;
}