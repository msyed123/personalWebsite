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
            <li v-for="skill in skills" v-bind:key="skill.id">
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
                {task:"HTML5",      percent:90,   color:"#ec407a"},
                {task:"CSS3", 		percent:76,   color:"#f4511e"},
                {task:"JAVASCRIPT", percent:84,   color:"#512da8"},
                {task:"MATERIALIZE",percent:94,   color:"#f57c00"},
                {task:"VUE",		percent:93,   color:"#0288d1"},
                {task:"MONGODB", 	percent:87,   color:"#388e3c"}
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

.box{
	width: 600px;
	padding: 40px;
	margin:50px auto;
	background:#f3f3f3;
	box-shadow: 3px 3px 10px 3px rgba(0, 0, 0, 0.1);
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
