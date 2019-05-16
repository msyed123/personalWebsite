<template>
    <div>   
        <li v-for="project in projects" v-bind:key="project.data.title">
            <b-card 
            no-body
            border-variant="primary"
            header-bg-variant="primary"
            header-text-variant="white" 
            class="overflow-hidden"
            v-bind:header="project.data.project_title[0].text"
            v-bind:footer="project.data.project_dates[0].text"
            >
                <b-card-body>
                    <b-card-img
                        v-bind:src="project.data.project_image.url"
                    ></b-card-img>
                    <b-card-text>
                        <b>Role: {{project.data.project_role[0].text}}</b>
                        <li v-for="description in project.data.project_details" v-bind:key="description.text">
                            {{description.text}}
                        </li>
                        <br />
                    </b-card-text>
                </b-card-body>
            </b-card>
        </li>
    </div>
</template>

<script>
import Prismic from "prismic-javascript";
import PrismicDom from "prismic-dom";
import PrismicConfig from "~/prismic.config.js";

export default {
    data() {
        return{
            projects: []
        };
    }, 

    methods: {
        async getProjects() {
            const api = await Prismic.getApi(PrismicConfig.apiEndpoint);
            const response = await api.query(
                Prismic.Predicates.at("document.type", "project"),
                { orderings : '[my.project.priority]'}
            )
            this.projects = response.results;
        }
    },

    created() {
        this.getProjects()
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
