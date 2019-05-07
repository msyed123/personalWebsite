<template>
    <div>   
        <li v-for="project in projects" v-bind:key="project.project">
            <b-card 
            no-body
            border-variant="primary"
            header-bg-variant="primary"
            header-text-variant="white" 
            class="overflow-hidden"
            v-bind:header="project.title"
            >
                <b-row no-gutters>
                <b-col md="4">
                    <b-card-img src="https://picsum.photos/400/400/?image=20" class="rounded-0"></b-card-img>
                </b-col>
                <b-col md="6">
                    <b-card-body sub-title="Horizontal Card">
                    <b-card-text>
                        This is a wider card with supporting text as a natural lead-in to additional content.
                        This content is a little bit longer.
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
                {title:"Fusion 360", percent:90,   color:"#ec407a"},
                {title:"Siemens NX", percent:75,   color:"#512da8"},
                {title:"ANSYS",      percent:80,   color:"#f57c00"},
                {title:"Simulink",   percent:75,   color:"#0288d1"},
                {title:"C++", 	     percent:85,   color:"#388e3c"},
                {title:"Python",     percent:90,   color:"#f4511e"},
                {title:"Machining",  percent:80,   color:"#2C3539"}
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

.percent{
	float: right;
	font-weight: 600;
	height: 30px;
	line-height: 30px;
}
</style>
