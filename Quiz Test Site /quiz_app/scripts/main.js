
const landingPage = document.getElementById("landing-page");
const quizPage = document.getElementById("quiz-page");
const btnStart = document.getElementById("btn-start");
const btnCheckAnswer = document.getElementById("btn-check-answer");
const btnLooseTryAgain = document.getElementById("btn-try-again");
const quizMessageBox = document.getElementById("quiz-message-box");
const quizQuestion = document.getElementById("quiz-question");
const quizLoseModal = document.getElementById("loose-modal");
const quizWinModal = document.getElementById("win-modal");
const btnLooseEnd = document.getElementById("btn-loose-end");
const btnWinEnd = document.getElementById("btn-win-end");

let selectedAnswer = 0;
let currentQuestionIndex = 0;

btnStart.addEventListener('click', function(event){
    event.preventDefault();
    startQuiz();
});
btnCheckAnswer.addEventListener('click', function(event){
    event.preventDefault();
    checkAnswer(quizQuestions[currentQuestionIndex]);
});
btnLooseTryAgain.addEventListener('click', function(event){
    event.preventDefault();
    checkAnswer(quizQuestions[currentQuestionIndex]);
    quizLoseModal.style.visibility = "hidden";
});
btnLooseEnd.addEventListener('click', function(event){
    event.preventDefault();
    window.location.reload();
});
btnWinEnd.addEventListener('click', function(event){
    event.preventDefault();
    window.location.reload();
});

let quizQuestions = [
    {
        "question": "What color is the sky?",
        "answers": ['blue', 'red', 'yellow', 'turtles'],
        "correctAnswerIndex": 0
    },
    {
        "question": "What is the best sci-fi show the ***** Fox killed too soon?",
        "answers": ['star trek', 'star wars', 'babylon 5', 'firefly'],
        "correctAnswerIndex": 3
    },
    {
        "question": "What is the greatest story ever told?",
        "answers": ['Jurassic Park', 'the odysee', 'of mice and men', "the bible"],
        "correctAnswerIndex": 0
    }
];

function startQuiz(){
    hidePage(landingPage);
    setupQuizQuestion(quizQuestions[currentQuestionIndex]);
    showPage(quizPage);
}

function setupQuizQuestion(question){
    //Create the paragraph to ask the question
    let questionText = document.createElement("p");
    questionText.innerText = question.question;
    quizQuestion.innerHTML = "";
    quizQuestion.appendChild(questionText);
    //Create the unordered list to display the answers
    let answers = document.createElement("select");
    for(let i = 0; i < question.answers.length; i++){
        let option = document.createElement("option");
        option.value = i;
        option.innerText = question.answers[i];
        answers.appendChild(option);
    }
    answers.addEventListener('change', function(event){
        event.preventDefault();
        selectedAnswer = answers.value;
    });
    quizQuestion.appendChild(answers);
    quizMessageBox.innerHTML = "";
    quizWinModal.style.visibility = "hidden";
    quizLoseModal.style.visibility = "hidden";
}


function checkAnswer(question){
    if(selectedAnswer == question.correctAnswerIndex){
        quizMessageBox.innerHTML = "<p>Correct!</p>";
        let nextButton = document.createElement("button");
        nextButton.innerText = "Next";
        nextButton.addEventListener("click", function(){
            currentQuestionIndex++;
            setupQuizQuestion(quizQuestions[currentQuestionIndex]);
        });
        if(currentQuestionIndex < quizQuestions.length - 1){
            quizMessageBox.appendChild(nextButton);
        }
        else {
            quizWinModal.style.visibility = "visible";
        }
    }
    else{
        quizLoseModal.style.visibility = "visible";
    }
}

hidePage(quizPage);

function showPage(pageToShow){
    pageToShow.style.visibility = "visible";
}

function hidePage(pageToHide){
    pageToHide.style.visibility = "hidden";
}