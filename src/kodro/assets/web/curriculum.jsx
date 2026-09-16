/* Teaching plans transcribed from docs/teachers/scheme-of-work.md.
 * Challenge content, grading and progress remain owned by the existing lesson flow. */
(function () {
  const BLOCKS = [
  {
    "id": "A",
    "title": "First programs",
    "lessons": [
      {
        "id": "000_watch_it_go",
        "objective": "Run one instruction, predict the result, then change one number so the rover travels 2 metres.",
        "prior": "None. Read one short instruction with an adult if needed.",
        "minutes": 30
      },
      {
        "id": "00_first_drive",
        "objective": "Change or repeat `move_forward` so the rover travels 3 metres to the flag. Explain that instructions run from top to bottom.",
        "prior": "None. Pupils should be able to read a one-line instruction and change a number.",
        "minutes": 35
      },
      {
        "id": "00a_turn_the_corner",
        "objective": "Arrange drive, quarter-turn and drive instructions in the required order.",
        "prior": "Complete Drive to the Flag. Recognise a quarter turn as 90 degrees.",
        "minutes": 35
      },
      {
        "id": "00b_repeat_square",
        "objective": "Use a `for` loop to repeat a move and a 90 degree turn four times. Explain why repetition is better than four copied blocks.",
        "prior": "Complete Drive to the Flag. Know that a square has four equal sides and four right angles.",
        "minutes": 45
      },
      {
        "id": "00c_look_first",
        "objective": "Ask `obstacle_ahead()` before moving and use `if` to turn only when the answer is true.",
        "prior": "Complete Make a Square. Recognise a sensor as an input and keep indented code inside an `if`.",
        "minutes": 45
      },
      {
        "id": "00d_fix_the_turn",
        "objective": "Observe a collision, locate the wrong turn and correct one command.",
        "prior": "Complete Turn the Corner. Understand that debugging means finding and correcting an error.",
        "minutes": 35
      },
      {
        "id": "16_variables",
        "objective": "Change one stored distance and explain why both movements change when the variable is used twice.",
        "prior": "Complete Sequence. Recognise assignment as giving a value a name.",
        "minutes": 45
      }
    ]
  },
  {
    "id": "B",
    "title": "Routes and decisions",
    "lessons": [
      {
        "id": "01_hello_rover",
        "objective": "Build the exact sequence `move_forward`, `beep`, `log` and make the rover travel at least 1.5 metres.",
        "prior": "No Kodro experience required. Pupils should recognise a function call and a string in quotation marks.",
        "minutes": 45
      },
      {
        "id": "02_move_turn",
        "objective": "Combine movement, a left turn and sample collection to reach the patch at `(4, 4)`.",
        "prior": "Complete Hello, Rover! Know that a turn changes heading rather than position.",
        "minutes": 50
      },
      {
        "id": "03_sequence",
        "objective": "Plan and debug a U-shaped route, then collect the sample at the far end.",
        "prior": "Complete Move and turn. Trace a program line by line and sketch a route on a grid.",
        "minutes": 50
      },
      {
        "id": "04_selection",
        "objective": "Use the existing sensor decision and add the action that completes the mission. Explain what `obstacle_ahead(2.0)` asks.",
        "prior": "Complete Sequence. Know that a Boolean question is either true or false.",
        "minutes": 55
      },
      {
        "id": "04a_fix_the_condition",
        "objective": "Run a faulty Boolean condition, explain why it is backwards and remove the negation so the rover avoids the obstacle.",
        "prior": "Complete Selection. Read `not` as reversing a Boolean value.",
        "minutes": 45
      }
    ]
  },
  {
    "id": "C",
    "title": "Control and sensing",
    "lessons": [
      {
        "id": "05_iteration",
        "objective": "Use `while` and small forward steps to find and collect three samples.",
        "prior": "Complete Selection. Understand that a loop needs a condition and that its body must change the situation.",
        "minutes": 60
      },
      {
        "id": "06_functions",
        "objective": "Put move, collect and turn into `hop()`, then call the function four times.",
        "prior": "Complete Iteration. Identify a repeated pattern and follow indentation inside `def`.",
        "minutes": 50
      },
      {
        "id": "07_sensors",
        "objective": "Read distance in a `while` condition, stop before the wall and collect the sample.",
        "prior": "Complete Iteration. Compare numbers and interpret `>` as greater than.",
        "minutes": 50
      },
      {
        "id": "08_pathfinding",
        "objective": "Reuse `dodge()` inside an outward and return loop so the rover collects the sample and comes home without a collision.",
        "prior": "Complete Functions and Selection. Use `while`, `if`, `else` and a function call independently.",
        "minutes": 60
      }
    ]
  },
  {
    "id": "D",
    "title": "From patterns to general solutions",
    "lessons": [
      {
        "id": "09_recursion",
        "objective": "Trace a function that calls itself with a smaller value and explain how the base case stops it.",
        "prior": "Complete Functions. Follow a function parameter, subtraction and `return`.",
        "minutes": 55
      },
      {
        "id": "10_optimisation",
        "objective": "Compare sample orderings, keep a route within the stated step and battery limits, and return to base.",
        "prior": "Complete Pathfinding. Add route distances and compare two algorithms for the same task.",
        "minutes": 60
      },
      {
        "id": "11_decomposition",
        "objective": "Split a patrol into named legs and call both helpers in the correct order.",
        "prior": "Complete Functions. Explain why a meaningful function name helps testing and reading.",
        "minutes": 50
      },
      {
        "id": "12_abstraction",
        "objective": "Replace blind movement with a sensor decision so the program responds to the environment.",
        "prior": "Complete Reading sensors. Use `while`, `if`, `else` and a Boolean sensor call.",
        "minutes": 55
      },
      {
        "id": "13_nested_loops",
        "objective": "Put a row sweep inside an outer loop so the rover covers two rows and collects six samples.",
        "prior": "Complete Iteration. Trace one complete inner loop before moving to the next outer pass.",
        "minutes": 60
      },
      {
        "id": "14_counting",
        "objective": "Use an accumulator in a `while` loop and stop when the count reaches three.",
        "prior": "Complete Iteration. Assign a value, update it and compare it with a target.",
        "minutes": 50
      },
      {
        "id": "15_parameters",
        "objective": "Add a `distance` parameter to `hop()` and call one function with three different values.",
        "prior": "Complete Functions. Distinguish a parameter in a definition from an argument in a call.",
        "minutes": 50
      },
      {
        "id": "17_lists",
        "objective": "Correct a list of three distances while leaving the loop unchanged, showing how data can describe a route.",
        "prior": "Complete Iteration and One name, used twice. Read a list and trace a `for` loop over its values.",
        "minutes": 50
      }
    ]
  }
];
  const { useState } = React;
  function planText(block, lessons) {
    return ['Kodro: ' + block.title, 'Suggested timings; adjust for your class. Add 10 minutes for first-time setup.',
      'Scores are practice feedback. Ask pupils to explain their work.',
      ...block.lessons.map((step, i) => {
        const lesson = lessons.find(l => l.id === step.id);
        return ['\nSession ' + (i + 1) + ': ' + (lesson ? lesson.title : step.id),
          'Time: ' + step.minutes + ' minutes', 'Objective: ' + step.objective,
          'Before starting: ' + step.prior,
          '5 min: Predict the route before running.', '5 min: Model the starter and discuss what needs changing.',
          (step.minutes - 20) + ' min: Build, run, read feedback and improve one change at a time.',
          '5 min: Compare two approaches with a partner.', '5 min: Explain one change and its effect.',
          'Support: Trace each instruction together; use the lesson hint after an attempt.',
          'Stretch: Predict how a changed input affects the route, then test your prediction.',
          lesson ? 'Challenge: ' + lesson.intro.trim() : 'Challenge unavailable. Reopen the lesson library.',
          'Evidence: Keep a route sketch, a prediction and the final program.'].join('\n');
      })].join('\n\n');
  }
  function Curriculum({ lessons, results, onStart }) {
    const [selected, setSelected] = useState('A');
    const [downloadError, setDownloadError] = useState('');
    const block = BLOCKS.find(b => b.id === selected) || BLOCKS[0];
    const completed = block.lessons.filter(s => results[s.id] && results[s.id].passed).length;
    function download() {
      try {
        const url = URL.createObjectURL(new Blob([planText(block, lessons)], { type: 'text/plain;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = 'kodro-block-' + block.id.toLowerCase() + '-lesson-plan.txt';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setDownloadError('');
      } catch (e) { setDownloadError('The plan could not download. You can still read each session below.'); }
    }
    return <section className="curriculum" aria-label="Teacher lesson plans">
      <h3>Ready-to-teach lesson plans</h3>
      <p>Choose a teaching block. Each session opens a pre-built challenge with starter code and feedback.</p>
      <div className="curriculum-blocks" role="group" aria-label="Teaching blocks">
        {BLOCKS.map(b => <button type="button" className="btn-mini" key={b.id} aria-pressed={selected === b.id} onClick={() => setSelected(b.id)}>{b.id}. {b.title}</button>)}
      </div>
      <div className="curriculum-heading"><h4>{block.title}</h4><span>{completed} of {block.lessons.length} challenges passed</span>
        <button type="button" className="btn-mini" onClick={download}>Download lesson plan</button></div>
      <p>Allow 10 extra minutes for first-time setup. In pairs, swap the keyboard halfway through. Choose sessions to match your class; prerequisites are guidance, not locks.</p>
      {downloadError && <p role="alert">{downloadError}</p>}
      <ol className="curriculum-sessions">{block.lessons.map((step, index) => {
        const lesson = lessons.find(l => l.id === step.id);
        const passed = !!(results[step.id] && results[step.id].passed);
        return <li key={step.id}><details open={index === 0}>
          <summary><strong>{index + 1}. {lesson ? lesson.title : step.id}</strong><span>{step.minutes} min{passed ? ' · Passed' : ''}</span></summary>
          <div className="curriculum-session-body"><p><strong>Learning goal:</strong> {step.objective}</p>
            <p><strong>Before starting:</strong> {step.prior}</p>
            <ol><li>Predict the route before pressing Run. <b>5 min</b></li><li>Show the starter and discuss what needs changing. <b>5 min</b></li><li>Build, run, read feedback and improve. <b>{step.minutes - 20} min</b></li><li>Compare approaches with a partner. <b>5 min</b></li><li>Explain one change and its effect. <b>5 min</b></li></ol>
            <p><strong>Support:</strong> Trace each instruction together. Use the lesson hint after an attempt.</p>
            <p><strong>Stretch:</strong> Predict how a changed input affects the route, then test it.</p>
            <p><strong>Check understanding:</strong> Ask for a route sketch, a prediction and an explanation. A passing run alone does not show understanding.</p>
            <button type="button" className="ctrl ctrl-run" disabled={!lesson} onClick={() => onStart(lesson)}>{passed ? 'Revisit challenge' : 'Open challenge'}</button>
            {!lesson && <p role="status">This challenge is unavailable. Reopen the lesson library to try loading it again.</p>}
          </div></details></li>;
      })}</ol>
    </section>;
  }
  window.KodroCurriculum = Curriculum;
  window.KodroCurriculumData = { blocks: BLOCKS, planText };
})();
