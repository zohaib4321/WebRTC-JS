let APP_ID = "4c89a6df481b4860b1331d5590accefb";
let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get("room");

if (!roomId) window.location = "room.html";

let client;
let channel;

let localStream;
let remoteStream;
let peerConnection;

const servers = {
	iceServers: [
		{
			urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
		},
	],
};

let constraints = {
	video: {
		width: { min: 640, ideal: 1920, max: 1920 },
		height: { min: 480, ideal: 1080, max: 1080 },
	},
	audio: {
		echoCancellation: { exact: true },
		noiseSuppression: { exact: true },
		autoGainControl: { exact: true },
	},
};

async function init(constraints) {
	client = await AgoraRTM.createInstance(APP_ID);
	await client.login({ uid, token });

	channel = await client.createChannel(roomId);
	await channel.join(roomId);

	channel.on("MemberJoined", handleUserJoin);
	channel.on("MemberLeft", handleMemberLeft);

	client.on("MessageFromPeer", handleMessageFromPeer);

	localStream = await window.navigator.mediaDevices.getUserMedia(constraints);
	document.getElementById("user1").srcObject = localStream;
}

function handleUserJoin(MemberId) {
	console.log("A new user joined the channel", MemberId);
	createOffer(MemberId);
}

function handleMemberLeft() {
	document.getElementById("user2").style.display = "none";
	document.getElementById("user1").classList.remove("smallFrame");
}

function handleMessageFromPeer(message, MemberId) {
	message = JSON.parse(message.text);

	if (message.type === "offer") {
		createAnswer(message.offer, MemberId);
	}

	if (message.type === "answer") {
		addAnswer(message.answer);
	}

	if (message.type === "candidate") {
		if (peerConnection) {
			peerConnection.addIceCandidate(message.candidate);
		}
	}
}

async function createPeerConnection(MemberId) {
	peerConnection = new RTCPeerConnection(servers);

	remoteStream = new MediaStream();
	document.getElementById("user2").srcObject = remoteStream;
	document.getElementById("user2").style.display = "block";

	document.getElementById("user1").classList.add("smallFrame");

	if (!localStream) {
		localStream = await window.navigator.mediaDevices.getUserMedia(constraints);
		document.getElementById("user1").srcObject = localStream;
	}

	localStream.getTracks().forEach((track) => {
		peerConnection.addTrack(track, localStream);
	});

	peerConnection.ontrack = function (event) {
		event.streams[0].getTracks().forEach((track) => {
			remoteStream.addTrack(track);
		});
	};

	peerConnection.onicecandidate = async function (event) {
		if (event.candidate) {
			client.sendMessageToPeer(
				{
					text: JSON.stringify({
						type: "candidate",
						candidate: event.candidate,
					}),
				},
				MemberId
			);
		}
	};
}

async function createOffer(MemberId) {
	await createPeerConnection(MemberId);

	let offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);

	client.sendMessageToPeer(
		{ text: JSON.stringify({ type: "offer", offer: offer }) },
		MemberId
	);
}

async function createAnswer(offer, MemberId) {
	await createPeerConnection(MemberId);

	await peerConnection.setRemoteDescription(offer);
	let answer = await peerConnection.createAnswer();
	await peerConnection.setLocalDescription(answer);

	client.sendMessageToPeer(
		{ text: JSON.stringify({ type: "answer", answer: answer }) },
		MemberId
	);
}

async function addAnswer(answer) {
	if (!peerConnection.currentRemoteDescription) {
		await peerConnection.setRemoteDescription(answer);
	}
}

async function leaveChannel() {
	await channel.leave();
	await client.logout();
}

function toggleMic() {
	const audioTrack = localStream
		.getTracks()
		.find((track) => track.kind === "audio");

	if (audioTrack.enabled) {
		audioTrack.enabled = false;
		document.getElementById("mic-btn").style.backgroundColor =
			"rgb(255, 80, 80)";
	} else {
		audioTrack.enabled = true;
		document.getElementById("mic-btn").style.backgroundColor =
			"rgb(179, 102, 249, .9)";
	}
}

function toggleCamera() {
	const videoTrack = localStream
		.getTracks()
		.find((track) => track.kind === "video");

	if (videoTrack.enabled) {
		videoTrack.enabled = false;
		document.getElementById("camera-btn").style.backgroundColor =
			"rgb(255, 80, 80)";
	} else {
		videoTrack.enabled = true;
		document.getElementById("camera-btn").style.backgroundColor =
			"rgb(179, 102, 249, .9)";
	}
}

window.addEventListener("beforeunload", leaveChannel);

document.getElementById("mic-btn").addEventListener("click", toggleMic);
document.getElementById("camera-btn").addEventListener("click", toggleCamera);

init(constraints);
