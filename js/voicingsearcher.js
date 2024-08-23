const VOICING_MAX_WIDTH_DEFAULT = 19; //max voicing distance between low and high note
var VOICING_MAX_WIDTH = 19;
const VOICING_MIN_NOTES = 4;  //because two notes aren't useful
const VOICING_MAX_NOTES = 5;

//generally minor 2nds and minor 9ths are very dissonant and are disincentivized. octaves and fifths are 
//very consonant. 
const CONSONANCE_VECTOR = [0,-2,1,1,1,0,-1,2,0,1,0,0,2,-2,1,1,1,0,-1,2,0,1,0,0,2];

//small intervals and intervals over a fifth have to be disincentivized or chords like 0 1 2 18 19, 
//which are not wide inbetween the notes, get top spot. 
const WIDTH_VECTOR = [0,-3,-2,-1,0,1,2,3,3,3,4,4,4,5,5,5,5,6]; 


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
	let name = chordNames[A.join("")] ?? ""; //defined in chordnames2.js
	
	return [A,amountToRotate,name];
}

//calculates interval vector as well as interval scores
function getIntervalInfo(voicing) {
	let iV = new Array(VOICING_MAX_WIDTH+1);
	iV.fill(0);
	let allPairs = subsets(voicing,2,2);
	let j = 0;
	//calculate interval vector
	for (i of allPairs) {
		j = Math.abs(i[1] - i[0]); //i[0] should always be smaller than i[1] but abs() just in case
		if (j <= VOICING_MAX_WIDTH) iV[j]++;
	}
	
	//let tertianScore = ( iV[3] + iV[4] + iV[15] + iV[16] ) * 2 + iV[8] + iV[9]; 
	let quintalScore = ( iV[7] + iV[14] + iV[5] + iV[10] ) * 2 + iV[2] + iV[19] + iV[17] //TODO define this in a smart way
	let consonanceScore = 0;
	let widthScore = 0;
	for (let i = 0; i < VOICING_MAX_WIDTH + 1; i++) {
		consonanceScore += iV[i] * (CONSONANCE_VECTOR[i] ?? 0);
		widthScore      += iV[i] * (WIDTH_VECTOR[i]      ?? 6);
	}
	
	//golf-ful oneliner that normalizes and formats the scores
	return [consonanceScore,quintalScore,widthScore].map(e=>(e/allPairs.length).toFixed(1));
}

const fmsynth = new Tone.PolySynth(Tone.FMSynth,{
	oscillator: {
		type: "sine",
	},
	modulation: {
		type: "sine",
	},
	harmonicity: 5, //(this basically just means modulator coarse tuning)
	modulationIndex: 5, //modulator level
	modulationEnvelope: {
		attack: 0.01,
		decay: 0.8,
		sustain: 0.1,
		release: 0.8,
	},
	envelope: {
		attack: 0.01,
		decay: 6.0,
		sustain: 0.0,
		release: 0.1,
	},
}).toDestination();
fmsynth.maxPolyphony = 128;
	
function playVoicing(voicing,transpose) {
	frequencies = voicing.map( e => (
		e += 36,
		e -= transpose, //this extra transpose parameter comes from getsetInfo() and makes each pitch set play in the same key- it cancels out the inversions within a pitch set
		e = mtof(e)
	));
	for (i in frequencies) {
		fmsynth.triggerAttackRelease(frequencies[i],"1n",Tone.now() + i/16);
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
	let tdwidth = document.createElement('td');
	
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
	tdwidth.textContent = intervalinfo[2];
	
	tdconsonance.className = "right";
	tdquintal.className = "right";
	tdwidth.className = "right";
	
	tr.appendChild(tdvoicing);
	tr.appendChild(tdset);
	tr.appendChild(tdname);
	
	tr.appendChild(tdbutton);
	
	tr.appendChild(tdconsonance);
	tr.appendChild(tdquintal);
	tr.appendChild(tdwidth);
	
	tablebody.appendChild(tr);
}

window.addEventListener('DOMContentLoaded', (event) => {
	clickprompt = document.getElementById("clickprompt");
	clickprompt.addEventListener("click", async () => {
		await Tone.start();
		console.log("tone.js ready");
		clickprompt.remove();
	})
	
	VOICING_MAX_WIDTH = parseInt(new URLSearchParams(window.location.search).get('maxwidth') ?? VOICING_MAX_WIDTH_DEFAULT);
	
	//initialize table sorter
	$(".tablesorter").tablesorter({
		theme: 'dark',
		ignoreCase: true,
		headerTemplate : '{content} {icon}', // Add icon for various themes
		widgets: ['stickyHeaders', 'filter', 'zebra'],
		widgetOptions: {
			// The zIndex of the stickyHeaders, allows the user to adjust this to their needs
			stickyHeaders_zIndex : 2,
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