const VOICING_MAX_WIDTH = 19; //max voicing distance between low and high note
const VOICING_MIN_NOTES = 4;  //because two notes aren't useful
const VOICING_MAX_NOTES = 5;  //
const CONSONANCE_VECTOR = [0,-2,1,1,1,0,-1,2,0,1,0,0,2,-2,1,1,1,0,-1,2];


//midi note to frequency
function mtof(n) {
	return 440 * 2**((n-49)/12);
}

function sum(A) {
	let b = 0;
	for (i in A) {
		b += A[i];
	}
	return b;
}

function rms(A) {
	B = A.map(e=>e**2); //square all elements
	return Math.sqrt( sum(B)/B.length );
}

function calcSubset(A, res, subset, index, minSize, maxSize) {
    // Add the current subset to the result list
	if (subset.length <= maxSize & subset.length >= minSize) {
		res.push([...subset]);
	}

    // Generate subsets by recursively including and excluding elements
    for (let i = index; i < A.length; i++) {
        // Include the current element in the subset
        subset.push(A[i]);

        // Recursively generate subsets with the current element included
        calcSubset(A, res, subset, i + 1, minSize, maxSize);

        // Exclude the current element from the subset (backtracking)
        subset.pop();
    }
}

//find all subsets in set A
function subsets(A, minSize, maxSize) {
    const subset = [];
    const res = [];
    let index = 0;
    calcSubset(A, res, subset, index, minSize, maxSize);
    return res;
}

function removeDuplicates(A) {
    return A.sort((a, b) => a - b).filter(function(item, pos, ary) {
        return !pos || item != ary[pos - 1];
    });
}

//multipurpose function that calculates the reduced set and returns the chord name and some other stuff
function getsetInfo(voicing) {
	//calculate unreduced set
	let A = voicing.map(e => e%=12);
	A = removeDuplicates(A);
	
	//calculate how far apart the notes are
	let B = [];
	for (let i = 0; i<A.length; i++) {
		B[i] = Math.abs( A.at(i) - A.at(i-1) );
		if (i==0) B[i] = 12 - B[i];
	}
	//The note farthest away from the previous note should be moved to 0
	//(this variable is also useful for making chords play in the same key)
	amountToRotate = A[ B.indexOf(Math.max(...B)) ];
	
	A = A.map(
		e => ( 
			e = (e - amountToRotate + 12) % 12,
			e = e==10?"A":e==11?"B":e //replace 10 and 11 with A and B
		)
	);
	A.sort((a, b) => parseInt(a,12) - parseInt(b,12)); //A now contains readable sorted and reduced set
	//find name for A
	let name = chordNames[A.join("")] ?? "";
	
	return [A,amountToRotate,name];
}

//calculates interval vector as well as interval scores
function getIntervalInfo(voicing) {
	let iV = new Array(20);
	iV.fill(0);
	let allPairs = subsets(voicing,2,2);
	let j = 0;
	//calculate interval vector
	for (i of allPairs) {
		j = Math.abs(i[1] - i[0]); //i[0] should always be smaller than i[1] but abs() just in case
		if (j <= 19) iV[j]++;
	}
	
	//let tertianScore = ( iV[3] + iV[4] + iV[15] + iV[16] ) * 2 + iV[8] + iV[9]; 
	let quintalScore = ( iV[7] + iV[14] + iV[5] + iV[10] ) * 2 + iV[2] + iV[19] + iV[17] //TODO define this in a smart way
	let consonanceScore = 0;
	for (let i = 0; i < 20; i++) {
		consonanceScore += iV[i] * CONSONANCE_VECTOR[i];
	}
	
	return [consonanceScore,quintalScore];
}

const sampler = new Tone.Sampler({
		urls: {
			"A#3": "Bb2.mp3",
			"F3":  "F2.mp3",
			"C4": "C3.mp3",
			"F4": "F3.mp3",
			"A5": "A4.mp3", 
			"C5": "C4.mp3"
		},
		release: 1,
		baseUrl: "guitar/"
	}).toDestination();
	
function playVoicing(voicing,transpose) {
	frequencies = voicing.map( e => (
		e += 36,
		e -= transpose, //this extra transpose parameter comes from getsetInfo() and makes each pitch set play in the same key- it cancels out the inversions within a pitch set
		e = mtof(e)
	));
	for (i in frequencies) {
		sampler.triggerAttackRelease(frequencies[i],"1n",Tone.now() + i/16);
	}
}

function listVoicing(tablebody,voicing) {
	let tr = document.createElement('tr');
	
	let tdvoicing = document.createElement('td');
	let tdset = document.createElement('td');
	let tdname = document.createElement('td');
	
	let tdbutton = document.createElement('td');
	let hearbutton = document.createElement('button');
	
	let tdconsonance = document.createElement('td');
	let tdquintal = document.createElement('td');
	let tdrms = document.createElement('td');
	
	let setinfo = getsetInfo(voicing);
	let intervalinfo = getIntervalInfo(voicing);
	
	hearbutton.onclick = function() {playVoicing(voicing,setinfo[1])};
	hearbutton.textContent = "hear";
	tdbutton.appendChild(hearbutton);
	
	tdvoicing.textContent = voicing.join(' ');
	tdset.textContent = setinfo[0].join('');
	tdname.textContent = setinfo[2];
	
	tdconsonance.textContent = intervalinfo[0];
	tdquintal.textContent = intervalinfo[1];
	tdrms.textContent = rms(voicing).toFixed(1);
	
	tdconsonance.className = "right";
	tdquintal.className = "right";
	tdrms.className = "right";
	
	tr.appendChild(tdvoicing);
	tr.appendChild(tdset);
	tr.appendChild(tdname);
	
	tr.appendChild(tdbutton);
	
	tr.appendChild(tdconsonance);
	tr.appendChild(tdquintal);
	tr.appendChild(tdrms);
	
	tablebody.appendChild(tr);
}

window.addEventListener('DOMContentLoaded', (event) => {
	clickprompt = document.getElementById("clickprompt");
	clickprompt.addEventListener("click", async () => {
        await Tone.start();
		console.log("tone.js ready");
		clickprompt.remove();
	})
	
	//initialize table sorter
	$(".tablesorter").tablesorter({
		theme: 'dark',
		ignoreCase: true,
		headerTemplate : '{content} {icon}', // Add icon for various themes
		widgets: ['stickyHeaders', 'filter', 'zebra'],
		widgetOptions: {

		  // extra class name added to the sticky header row
		  stickyHeaders : '',
		  // number or jquery selector targeting the position:fixed element
		  stickyHeaders_offset : 0,
		  // added to table ID, if it exists
		  stickyHeaders_cloneId : '-sticky',
		  // trigger "resize" event on headers
		  stickyHeaders_addResizeEvent : true,
		  // if false and a caption exist, it won't be included in the sticky header
		  stickyHeaders_includeCaption : true,
		  // The zIndex of the stickyHeaders, allows the user to adjust this to their needs
		  stickyHeaders_zIndex : 2,
		  // jQuery selector or object to attach sticky header to
		  stickyHeaders_attachTo : null,
		  // jQuery selector or object to monitor horizontal scroll position (defaults: xScroll > attachTo > window)
		  stickyHeaders_xScroll : null,
		  // jQuery selector or object to monitor vertical scroll position (defaults: yScroll > attachTo > window)
		  stickyHeaders_yScroll : null,

		  // scroll table top into view after filtering
		  stickyHeaders_filteredToTop: true
		},
		headers: {
			0: { sorter: "text" },
			1: { sorter: "text" },
			2: { sorter: "text" },
			3: { sorter: false, parser: false, filter: false }
		}
	});
	console.log("tablesorter ready");
	
	let notesset = [];
	for (let i = 1; i < VOICING_MAX_WIDTH + 1; i++) {
		notesset.push(i);
	}
	let allvoicings = subsets(notesset, VOICING_MIN_NOTES - 1, VOICING_MAX_NOTES - 1);
	
	let tablebody = document.getElementById('tablebody');
	for (i in allvoicings) {
		allvoicings[i].unshift(0); //add 0 to start
		listVoicing(tablebody, allvoicings[i]);
	}
	console.log("done listing voicings, updating tablesorter...");
	
	$.tablesorter.updateAll( $(".tablesorter")[0].config, false);
	console.log("done!");
});