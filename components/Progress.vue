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
                <div class="task">{{skill.data.task[0].text}}</div>
                <div class="bar">
                    <div class="progress" v-bind:style = "{'background':skill.data.color, 'width':skill.data.percent+'%'}"></div>
 		 			<span class="percent">{{skill.data.percent}}%</span>
                </div>
            </li>
        </ul>
    </b-card>
</template>

<script>
import Prismic from "prismic-javascript";
import PrismicDom from "prismic-dom";
import PrismicConfig from "~/prismic.config.js";

export default {
    data() {
        return{
            skills: []
        };
    },

    methods: {
        async getSkills() {
            const api = await Prismic.getApi(PrismicConfig.apiEndpoint, {accessToken: PrismicConfig.accessToken});
            const response = await api.query(
                Prismic.Predicates.at("document.type", "skill"),
                { orderings : '[my.project.percent desc]'}
            )
            this.skills = response.results;
        }
    },

    created () {
        this.getSkills()
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
