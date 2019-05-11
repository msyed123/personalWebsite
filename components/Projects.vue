<template>
    <div>   
        <li v-for="project in projects" v-bind:key="project.role">
            <b-card 
            no-body
            border-variant="primary"
            header-bg-variant="primary"
            header-text-variant="white" 
            class="overflow-hidden"
            v-bind:header="project.title"
            >
                <b-row no-gutters align-v="center">
                <b-col md="3">
                    <b-card-img src="https://picsum.photos/400/400/?image=20" class="rounded-0" style="padding: 10px; width: 100%;"></b-card-img>
                </b-col>
                <b-col md="6">
                    <b-card-body v-bind:sub-title="project.dates">
                    <b-card-text>
                        <b>Role: {{project.role}}</b>
                        <li v-for="description in project.description" v-bind:key="description.message">
                            {{description.message}}
                        </li>
                        <br />
                    </b-card-text>
                    </b-card-body>
                </b-col>
                </b-row>
            </b-card>
        </li>
    </div>
</template>

<script>
export default {
    data() {
        return{
            projects:[
                {title:"Florida Tech PantherLoop: SpaceX Hyperloop Competition", 
                 dates:"2018-Current",
                 role: "Team Lead",   
                 description:[
                    {message: "Designed functional requirements and interfaces for the entire pod. Assembled and deligated teams for the entire vehicle while also leading propulsion system development"},
                    {message: "Investigated a variety of pod propulsions technologies through preliminary design in Solidworks and design validation in ANSYS"},
                    {message: "Validated vehicle stability and propulsion system using Simulink in order to optimize the performance of the vehicle through all expected velocities"},
                    {message: "Prepared high performing preliminary design report detailing current system design that was one of 52 in the world selected to go the next phase of competition out of more than 1500 entries"}
                 ]},
                 {title:"DR-1: UAV Dynamic Rendezvous and Docking Algorithm",      
                 dates:"2018-Current",
                 role: "GN&C Co-Lead",    
                 description:[
                    {message: "Designed primary system architecture for approach and docking between a UAS and a UGV"},
                    {message: "Developed compliant approach algorithm for noisy metrology sensor"},
                    {message: "Performed validation tests for a metrology sensor developed at MSFC and currently onboard the ISS"},
                    {message: "Performed hardware integration and testing for legacy UAS hardware"}
                 ]},
                {title:"PanthAir: Design, Build, Fly", 
                 dates:"2018-2019",
                 role: "Structural Team Lead",    
                 description:[
                    {message: "Designed, prototyped, and fabricated UAV primary substructure, swing-wing mechanism, and modular hardpoint"},
                    {message: "Simulated flight and structural characteristics using ANSYS"},
                    {message: "Designed and simulated circuit to reduce channel usage for payload release mechanism in Autodesk Eagle"},
                    {message: "Prepared proposal to outline design elements and submitted it for national competition"}
                 ]},
                 
                {title:"Design of a Hybrid Flight-Mode UAV",      
                 dates:"2014-2017",
                 role: "Independent Researcher",    
                 description:[
                    {message: "Designed hybrid UAV integrating elements of a fixed wing design with a multirotor platform to increase operational efficiency and mission flexibility"},
                    {message: "Modified open-source flight control algorithms in C++"},
                    {message: "Simulated modified code in SITL simulator using Python"},
                    {message: "Received consecutive first-place finishes in senior engineering category at Brevard Mainland Science and Engineering Fair"}
                 ]}
            ]
        };
    }
};
</script>

<style>
body{
	font-family: monaco, monospace;
}

*{
	padding: 0;
	margin: 0;
	box-sizing:border-box;
}

li{
	list-style-type: none;
    padding-bottom: 20px
}

.project{
	margin:5px;
	font-size: 16px;
}

.bar{
	width: 100%;
	background:#dfdfdf;
	overflow: hidden;
	padding:5px;
}

.progress{
	float:left;
	padding:15px;
}

.dates{
	float: right;
	font-weight: 600;
	height: 30px;
	line-height: 30px;
}
</style>
