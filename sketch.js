// Bakeoff #2 - Seleção de Alvos Fora de Alcance
// IPM 2021-22, Período 3
// Entrega: até dia 22 de Abril às 23h59 através do Fenix
// Bake-off: durante os laboratórios da semana de 18 de Abril

// p5.js reference: https://p5js.org/reference/

// Database (CHANGE THESE!)
const GROUP_NUMBER = 4; // Add your group number here as an integer (e.g., 2, 3)
const BAKE_OFF_DAY = false; // Set to 'true' before sharing during the bake-off day

// Target and grid properties (DO NOT CHANGE!)
let PPI, PPCM;
let TARGET_SIZE;
let TARGET_PADDING, MARGIN, LEFT_PADDING, TOP_PADDING;
let continue_button;
let inputArea = { x: 0, y: 0, h: 0, w: 0 }; // Position and size of the user input area

// Metrics
let testStartTime, testEndTime; // time between the start and end of one attempt (54 trials)
let hits = 0; // number of successful selections
let misses = 0; // number of missed selections (used to calculate accuracy)
let database; // Firebase DB

// Study control parameters
let draw_targets = false; // used to control what to show in draw()
let trials = []; // contains the order of targets that activate in the test
let current_trial = 0; // the current trial number (indexes into trials array above)
let attempt = 0; // users complete each test twice to account for practice (attemps 0 and 1)
let fitts_IDs = []; // add the Fitts ID for each selection here (-1 when there is a miss)

// Helper variables
let next_background_color;

// ROLLOUT_TESTS
const __flags = {
  __flag_only_show_border_on_duplicate_pos: false,
  __flag_show_line_from_current_target_to_next: true,
  __flag_dotted_line_from_current_to_next: false,
  __flag_next_filled: false,
};

function setup_flags() {
  if (Math.random() >= 0.5) {
	__flags.__only_show_border_on_duplicate_pos = true;
  }
  if (Math.random() >= 0.5) {
    __flags.__flag_next_filled = true;
  }
  /*if (Math.random() >= 0.5) {
    __flags.__flag_show_line_from_current_target_to_next = true;
  }*/
  if (Math.random() >= 0.5) {
    __flags.__flag_dotted_line_from_current_to_next = true;
  }
}

// Target class (position and width)
class Target {
  constructor(x, y, w) {
    this.x = x;
    this.y = y;
    this.w = w;
  }
}

// Runs once at the start
function setup() {
  setup_flags();
  createCanvas(700, 500); // window size in px before we go into fullScreen()
  frameRate(60); // frame rate (DO NOT CHANGE!)

  randomizeTrials(); // randomize the trial order at the start of execution

  textFont('Arial', 18); // font size for the majority of the text
  drawUserIDScreen(); // draws the user start-up screen (student ID and display size)
}

// Runs every frame and redraws the screen
function draw() {
  if (draw_targets) {
    // The user is interacting with the 6x3 target grid
    background(next_background_color || color(0, 0, 0)); // sets background to black

    // Print trial count at the top left-corner of the canvas
    fill(color(255, 255, 255));
    textAlign(LEFT);
    text('Trial ' + (current_trial + 1) + ' of ' + trials.length, 50, 20);

    // Draw line from current target to next target
    drawGuidingArrow();

    // Draw all 18 targets
    for (var i = 0; i < 18; i++) drawTarget(i);

    // Draw the user input area
    drawInputArea();

    // Draw the virtual cursor
    let x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width);
    let y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height);

    // Change color of cursor if hovering a target (any target)
    fill(getMouseColor(x, y));
    circle(x, y, 0.5 * PPCM);
  }
}

// Get color of mouse depending if it's hovering a target or not
function getMouseColor(x, y) {
  // Loop over all 18 targets
  for (let i = 0; i < 18; ++i) {
    let target = getTargetBounds(i);
    if (dist(target.x, target.y, x, y) < target.w / 2) {
      return color(0, 255, 0);
    }
  }

  return color(255, 255, 255);
}

// Print and save results at the end of 54 trials
function printAndSavePerformance() {
  // DO NOT CHANGE THESE!
  let accuracy = parseFloat(hits * 100) / parseFloat(hits + misses);
  let test_time = (testEndTime - testStartTime) / 1000;
  let time_per_target = nf(test_time / parseFloat(hits + misses), 0, 3);
  let penalty = constrain(
    (parseFloat(95) - parseFloat(hits * 100) / parseFloat(hits + misses)) * 0.2,
    0,
    100
  );
  let target_w_penalty = nf(test_time / parseFloat(hits + misses) + penalty, 0, 3);
  let timestamp =
    day() + '/' + month() + '/' + year() + '  ' + hour() + ':' + minute() + ':' + second();

  background(color(0, 0, 0)); // clears screen
  fill(color(255, 255, 255)); // set text fill color to white
  text(timestamp, 10, 20); // display time on screen (top-left corner)

  textAlign(CENTER);
  text('Attempt ' + (attempt + 1) + ' out of 2 completed!', width / 2, 60);
  text('Hits: ' + hits, width / 2, 100);
  text('Misses: ' + misses, width / 2, 120);
  text('Accuracy: ' + accuracy + '%', width / 2, 140);
  text('Total time taken: ' + test_time + 's', width / 2, 160);
  text('Average time per target: ' + time_per_target + 's', width / 2, 180);
  text('Average time for each target (+ penalty): ' + target_w_penalty + 's', width / 2, 220);

  // Print Fitts IDS (one per target, -1 if failed selection)
  //
  text('Fitts Index of Performance', width / 2, 260);

  for (let i = 0; i < trials.length; ++i) {
    let x_pos = i / trials.length < 0.5 ? (2 * width) / 6 : (4 * width) / 6;

    let indexOfPerformance = fitts_IDs[i];
    let value;
    if (i === 0) {
      value = '---';
    } else if (indexOfPerformance < 0) {
      value = 'MISSED';
    } else {
      value = indexOfPerformance.toFixed(3);
    }

    text(`Target ${i + 1}: ${value}`, x_pos, 280 + 20 * (i % (trials.length / 2)));
  }

  // Saves results (DO NOT CHANGE!)
  let attempt_data = {
    project_from: GROUP_NUMBER,
    assessed_by: student_ID,
    test_completed_by: timestamp,
    attempt: attempt,
    hits: hits,
    misses: misses,
    accuracy: accuracy,
    attempt_duration: test_time,
    time_per_target: time_per_target,
    target_w_penalty: target_w_penalty,
    fitts_IDs: fitts_IDs,
    flags: __flags,
  };

  // Send data to DB (DO NOT CHANGE!)
  if (BAKE_OFF_DAY) {
    // Access the Firebase DB
    if (attempt === 0) {
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
    }

    // Add user performance results
    let db_ref = database.ref('G' + GROUP_NUMBER);
    db_ref.push(attempt_data);
  }
}

// Mouse button was pressed - lets test to see if hit was in the correct target
function mousePressed() {
  // Only look for mouse releases during the actual test
  // (i.e., during target selections)
  if (draw_targets) {
    // Get the location and size of the target the user should be trying to select
    let target = getTargetBounds(trials[current_trial]);

    // Check to see if the virtual cursor is inside the target bounds,
    // increasing either the 'hits' or 'misses' counters

    if (insideInputArea(mouseX, mouseY)) {
      let virtual_x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width);
      let virtual_y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height);

      if (dist(target.x, target.y, virtual_x, virtual_y) < target.w / 2) {
        hits++;
        next_background_color = color(0, 25, 0);
        if (current_trial === 0) {
          fitts_IDs.push(0);
        } else {
          fitts_IDs.push(
            calculateFittsIndexOfPerformance(trials[current_trial - 1], trials[current_trial])
          );
        }
      } else {
        misses++;
        next_background_color = color(25, 0, 0);
        fitts_IDs.push(-1);
      }

      current_trial++; // Move on to the next trial/target
    }

    // Check if the user has completed all 54 trials
    if (current_trial === trials.length) {
      testEndTime = millis();
      draw_targets = false; // Stop showing targets and the user performance results
      printAndSavePerformance(); // Print the user's results on-screen and send these to the DB
      attempt++;

      // If there's an attempt to go create a button to start this
      if (attempt < 2) {
        continue_button = createButton('START 2ND ATTEMPT');
        continue_button.mouseReleased(continueTest);
        continue_button.position(
          width / 2 - continue_button.size().width / 2,
          height / 2 - continue_button.size().height / 2
        );
      }
    }
  }
}

// Draw target on-screen
function drawTarget(i) {
  // Get the location and size for target (i)
  let target = getTargetBounds(i);

  // Check whether this target is the target the user should be trying to select
  // and also the next target to select
  if(trials[current_trial] === i){
	fill(color(255, 0, 0));
	if(trials[current_trial+1] === i){
	  stroke(color(255, 255, 0));
	  strokeWeight(4);
	}
  } else if (trials[current_trial+1] === i){
	if(__flags.__flag_next_filled){
	  fill(color(255,255,255));
	}
  } else {
    // Fill with grey color if this is not the target the user
    // should be trying to select
    fill(color(130, 130, 130));
	noStroke();
  }

  // Draws the target
  circle(target.x, target.y, target.w);
}

// Draw arrow from current target to next target
function drawGuidingArrow() {
  const current_target = getTargetBounds(trials[current_trial]);

  if (trials[current_trial - 1] !== undefined) {
    const prev_target = getTargetBounds(trials[current_trial - 1]);

    stroke(color(200, 200, 200));
    line(prev_target.x, prev_target.y, current_target.x, current_target.y);
  }

  if (trials[current_trial + 1] !== undefined) {
    const next_target = getTargetBounds(trials[current_trial + 1]);

    if (__flags.__flag_dotted_line_from_current_to_next) {
      drawingContext.setLineDash([10, 10]);
    }
    stroke(color(100, 100, 100));
    line(current_target.x, current_target.y, next_target.x, next_target.y);
    drawingContext.setLineDash([]);
  }
}

// Returns the location and size of a given target
function getTargetBounds(i) {
  var x = parseInt(LEFT_PADDING) + parseInt((i % 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);
  var y =
    parseInt(TOP_PADDING) + parseInt(Math.floor(i / 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);

  return new Target(x, y, TARGET_SIZE);
}

function calculateFittsIndexOfPerformance(target1, target2) {
  const target1_bounds = getTargetBounds(target1);
  const target2_bounds = getTargetBounds(target2);

  const distance = Math.sqrt(
    Math.pow(target1_bounds.x - target2_bounds.x, 2) +
      Math.pow(target1_bounds.y - target2_bounds.y, 2)
  );

  return Math.log(distance / target2_bounds.w + 1) / Math.log(2);
}

// Evoked after the user starts its second (and last) attempt
function continueTest() {
  // Re-randomize the trial order
  shuffle(trials, true);
  current_trial = 0;
  print('trial order: ' + trials);

  // Resets performance variables
  hits = 0;
  misses = 0;
  fitts_IDs = [];

  continue_button.remove();

  // Shows the targets again
  next_background_color = color(0, 0, 0);
  draw_targets = true;
  testStartTime = millis();
}

// Is invoked when the canvas is resized (e.g., when we go fullscreen)
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  let display = new Display({ diagonal: display_size }, window.screen);

  // DO NOT CHANGE THESE!
  PPI = display.ppi; // calculates pixels per inch
  PPCM = PPI / 2.54; // calculates pixels per cm
  TARGET_SIZE = 1.5 * PPCM; // sets the target size in cm, i.e, 1.5cm
  TARGET_PADDING = 1.5 * PPCM; // sets the padding around the targets in cm
  MARGIN = 1.5 * PPCM; // sets the margin around the targets in cm

  // Sets the margin of the grid of targets to the left of the canvas (DO NOT CHANGE!)
  LEFT_PADDING = width / 3 - TARGET_SIZE - 1.5 * TARGET_PADDING - 1.5 * MARGIN;

  // Sets the margin of the grid of targets to the top of the canvas (DO NOT CHANGE!)
  TOP_PADDING = height / 2 - TARGET_SIZE - 3.5 * TARGET_PADDING - 1.5 * MARGIN;

  // Defines the user input area
  inputArea = {
    x: width / 2 + 2 * TARGET_SIZE,
    y: height / 2,
    w: width / 3,
    h: height / 3,
  };

  // Starts drawing targets immediately after we go fullscreen
  draw_targets = true;
}

// Responsible for drawing the input area
function drawInputArea() {
  noFill();
  stroke(color(220, 220, 220));
  strokeWeight(2);

  rect(inputArea.x, inputArea.y, inputArea.w, inputArea.h);
}
