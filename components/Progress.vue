<template>
    <b-card
        class="mx-auto"
        style="width: 85%"
        border-variant="primary"
        header="Skills"
        header-bg-variant="primary"
        header-text-variant="white"
    >
        <ul>
            <li v-for="skill in skills" v-bind:key="skill.task">
                <div class="task">{{skill.task}}</div>
                <div class="bar">
                    <div class="progress" v-bind:style = "{'background':skill.color, 'width':skill.percent+'%'}"></div>
 		 			<span class="percent">{{skill.percent}}%</span>
                </div>
            </li>
        </ul>
    </b-card>
</template>

<script>
export default {
    data() {
        return{
            skills:[
                {task:"Fusion 360", percent:90,   color:"#ec407a"},
                {task:"Siemens NX", percent:75,   color:"#512da8"},
                {task:"ANSYS",      percent:80,   color:"#f57c00"},
                {task:"Simulink",	percent:75,   color:"#0288d1"},
                {task:"C++", 	    percent:85,   color:"#388e3c"},
                {task:"Python",     percent:90,   color:"#f4511e"},
                {task:"Machining",  percent:80,   color:"#2C3539"}
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

ul li{
	list-style-type: none;
	padding:10px;
}

.task{
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
