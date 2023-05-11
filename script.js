const cvs = document.getElementById("canvas");
const ctxt = cvs.getContext("2d");

const WIDTH = document.documentElement.clientWidth;
const HEIGHT = document.documentElement.clientHeight;

cvs.setAttribute("width", WIDTH);
cvs.setAttribute("height", HEIGHT);

ctxt.fillStyle = "rgba(0, 255, 0, 0.5)";
ctxt.strokeStyle = "rgba(0, 0, 0, 1.0)";


//単位は㎜
//参考：https://developer.mozilla.org/ja/docs/Games/Techniques/3D_on_the_web/Basic_theory
//参考：https://ascii.jp/elem/000/000/270/270141/
//参考：https://qiita.com/watabo_shi/items/f7c559c3cdbcdd0f2629

//頂点
class Vertex{
    constructor(location, rgba, normal){
        //位置
        this.x = location[0];
        this.y = location[1];
        this.z = location[2];
        //rgba = [r, g, b, a]
        this.col = rgba;
        //法線単位ベクトル
        this.nor = norm(vec([0, 0, 0], normal));
    }

    add([dx, dy, dz]){
        this.x += dx;
        this.y += dy;
        this.z += dz;
    }

    //回転
    rot(eular_angles ,center){
        this.pos = rotate(eular_angles, vec(center, this.pos));
        this.nor = rotate(eular_angles, this.nor);
    }
    get pos(){
        return [this.x, this.y, this.z];
    }
    set pos([x, y, z]){
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

//ポリゴン
class poly{
    constructor([vert1, vert2, vert3], normal){
        this.verts = [vert1, vert2, vert3];
        this.nor = normal;
    }
}

//2D
class Vert2D{
    constructor(x, y){
        this.x = parseFloat(x);
        this.y = parseFloat(y);
    }
}

//ライト
class light{
    constructor(direction){
        this.dir = direction;
    }
}

//カメラ
class camera{
    constructor(location, Field_of_View, aspect){
        this.loc = location;
        //位置
        this.x = location.x;
        this.y = location.y;
        this.z = location.z;
        //映す方向
        this.dir = [0, 0, -1];
        //垂直方向
        this.ori = [0,1,0];
        //水平方向
        this.hor = norm(cross(this.ori, this.dir));
        
        //視野率（距離と視野半径の比）
        this.FoV = Field_of_View / 100;
        //アスペクト比
        this.asp = aspect;

        //カメラの中にスクリーンを置いているイメージ
        //スクリーンまでの距離
        this.scd = 50;
        //表示時の比率
        this.ratio = this.culcSS(this.scd, this.FoV, this.asp);
    }
    culcSS(sc, FoV, asp){
        //スクリーンの対角線の長さ
        let diagonal = sc * FoV * 2;
        //スクリーンのタテ
        let h = Math.sqrt(diagonal ** 2 / (1 + asp ** 2));
        return HEIGHT / h;
    }
    move(dx, dy, dz){
        this.loc.x += dx;
        this.loc.y += dy;
        this.loc.z += dz;
        this.x += dx;
        this.y += dy;
        this.z += dz;
    }

    spin(psi, theta, phi){
        this.dir = rotate([psi, theta, phi], this.dir);
        this.ori = rotate([psi, theta, phi], this.ori);
        this.hor = rotate([psi, theta, phi], this.hor);

    }
    //位置が視野に収まっているか判定
    withinFoV(vert) {
        let d = this.dir;
        //カメラからvertまでのベクトル
        let CV = vec(this.loc, vert);
        //CVとthis.dirの内積
        let CVd = CV[0] * d[0] + CV[1] * d[1] + CV[2] * d[2];
        if(CVd <= 0) return false;
        //this.dirにおろした垂線の距離
        let hV = len(vec(new Vertex(CVd * d[0] + this.x, CVd * d[1] + this.y, CVd * d[2] + this.z), vert));
        if (hV > CVd * this.FoV) return false;
        //視野内ならTrue
        return true;
    }

    render(objects, ctxt, dx, dy){
        ctxt.clearRect(0, 0, WIDTH, HEIGHT);
        for(let i = 0; i < objects.length; i++){
            for(let j = 0; j < objects[i].faces.length; j++){
                let face = objects[i].faces[j];
                //法線とカメラの向きのなす角が90度以下（なす角のcosが0以上）なら裏面と判断
                if(rtnCos(face.nor, this.dir) >= 0) continue;
                let count = 0;
                face.verts.forEach((e)=>{
                    if(this.withinFoV(e) == false)count++;
                });
                if(count === 3)continue;
                this.rasterization(face, ctxt, dx, dy);
            }
        }
    }

    //ラスタ化
    rasterization(face, ctxt, dx, dy){
        //ラスタ化する際の単位
        let px = 1;
        let face2D = [];
        face.verts.forEach((e)=>{
            face2D.push(this.project(e));
        });
        //スクリーン上のピクセルがFace2Dによる三角形内であるか判定
        for(let x = -dx; x < dx; x++){
            for (let y = -dy; y < dy; y++){
                //[x, y]の点を中心に持つ1辺の長さがpxの正方形の頂点が一つでも三角形の内部にあればよい
                let xx = [px / 2, px / 2, -px / 2, -px / 2];
                let yy = [px / 2, -px / 2, px / 2, -px / 2];
                for(let i = 0; i < 4; i++){
                    let tf = InOut([x + xx[i], y + yy[i]], face2D);
                    if(tf){
                        ctxt.fillRect(x + dx - px / 2, -y + dy- px / 2, px, px);
                        break;
                    } 
                }
            }
        }

        //外積によって判定
        function InOut([x, y], face2D){
            let num = 0;
            for(let i = 0; i < face2D.length; i++){
                let j = i + 1;
                if(j >= face2D.length) j = 0;
                let vec1 = [face2D[j].x - face2D[i].x, face2D[j].y - face2D[i].y];
                let vec2 = [x - face2D[i].x, y - face2D[i].y];
                //外積のz成分
                let cross = vec1[0] * vec2[1] - vec1[1] * vec2[0];
                //z成分が0なら、線上にある。線上にないときは全ての外積の符号が一致しているか考える
                if(cross === 0){
                    return true;
                }else if(cross > 0){
                    num++;
                }else{
                    num--;
                }
            }    
            if(Math.abs(num) === face2D.length) return true;
            return false;  
        }
    }

    project(M){
        let d = this.dir;
        let o = this.ori;
        let h = this.hor;
        //カメラからvertまでのベクトル
        let CV = vec(this.loc, M);
        //CVとthis.dirの内積
        let CVd = CV[0] * d[0] + CV[1] * d[1] + CV[2] * d[2];
        //CVとthis.oriの内積
        let CVo = CV[0] * o[0] + CV[1] * o[1] + CV[2] * o[2];
        //CVとthis.horの内積
        let CVh = CV[0] * h[0] + CV[1] * h[1] + CV[2] * h[2];
        
        let x = CVh * this.scd / CVd * this.ratio;
        let y = CVo * this.scd / CVd * this.ratio;
        return new Vert2D(x, y);
    }
}

//立方体
class cube{
    constructor(center, size){
        //1辺の長さの半分
        let d = size / 2; 
        //各頂点
        this.verts = [
            new Vertex([center.x - d, center.y + d, center.z + d],[0,0,0,0],[-1,1,1]),
            new Vertex([center.x + d, center.y + d, center.z + d],[0,0,0,0],[1,1,1]),
            new Vertex([center.x + d, center.y - d, center.z + d],[0,0,0,0],[1,-1,1]),
            new Vertex([center.x - d, center.y - d, center.z + d],[0,0,0,0],[-1,-1,1]),
            new Vertex([center.x - d, center.y + d, center.z - d],[0,0,0,0],[-1,1,-1]),
            new Vertex([center.x + d, center.y + d, center.z - d],[0,0,0,0],[1,1,-1]),
            new Vertex([center.x + d, center.y - d, center.z - d],[0,0,0,0],[1,-1,-1]),
            new Vertex([center.x - d, center.y - d, center.z - d],[0,0,0,0],[-1,-1,-1])
        ];
        //各面
        this.faces = [
            new poly([this.verts[0], this.verts[1], this.verts[3]], [0,0,1]),
            new poly([this.verts[2], this.verts[1], this.verts[3]], [0,0,1]),
            new poly([this.verts[1], this.verts[2], this.verts[5]], [1,0,0]),
            new poly([this.verts[6], this.verts[2], this.verts[5]], [1,0,0]),
            new poly([this.verts[6], this.verts[5], this.verts[7]], [0,0,-1]),
            new poly([this.verts[4], this.verts[5], this.verts[7]], [0,0,-1]),
            new poly([this.verts[0], this.verts[3], this.verts[4]], [-1,0,0]),
            new poly([this.verts[7], this.verts[3], this.verts[4]], [-1,0,0]),
            new poly([this.verts[4], this.verts[0], this.verts[5]], [0,1,0]),
            new poly([this.verts[1], this.verts[0], this.verts[5]], [0,1,0]),
            new poly([this.verts[7], this.verts[3], this.verts[6]], [0,-1,0]),
            new poly([this.verts[2], this.verts[3], this.verts[6]], [0,-1,0])
        ]
        this.size = size;
        this.center = center;
    }

    //回転
    //参考：https://www.sky-engin.jp/blog/rotation-matrix/
    spin(psi, theta, phi){
        this.verts.forEach((e)=>{
            let dx = e.x - this.center.x;
            let dy = e.y - this.center.y;
            let dz = e.z - this.center.z;
            let d = [
                dx, 
                dy, 
                dz
            ];
            //R、dの積を計算
            let Rd = rotate([psi, theta, phi], d);
            e.x = this.center.x + Rd[0];
            e.y = this.center.y + Rd[1];
            e.z = this.center.z + Rd[2];
            
            d = e.nor;
            Rd = rotate([psi, theta, phi], d);
            e.nor = Rd;
        });
        this.faces.forEach((e)=>{
            let d = e.nor;
            let Rd = rotate([psi, theta, phi], d);
            e.nor = Rd;
        });
    }

    //平行移動
    move(dx, dy, dz){
        this.center.add([dx, dy, dz]);
        this.verts.forEach((e)=>{
            e.add([dx, dy, dz]);
        });
    }
}
/*
//水平面
class Horizon{
    constructor(size){
        let d = size / 2;
        this.center = new Vertex(0, -200, 0); 
        this.verts = [
            new Vertex(this.center.x + d, this.center.y, this.center.z + d),
            new Vertex(this.center.x - d, this.center.y, this.center.z + d),
            new Vertex(this.center.x - d, this.center.y, this.center.z - d),
            new Vertex(this.center.x + d, this.center.y, this.center.z - d)
        ];
        this.faces = [
            this.verts
        ];
    }
    spin(){}
    move(){}
}*/

let cam = new camera(new Vertex([0, 0, 500], [0,0,0,0], [0,1,0]), 50, WIDTH/HEIGHT);
let c = new cube(new Vertex([0, 0, 0],[0,0,0,0],[0,0,0,0]), 50);
//let c2 = new cube(new Vertex(0, 100, 0), 50);
//let hori = new Horizon(200);
//let objs = [c, c2, hori];
let objs = [c];

let dx = WIDTH / 2;
let dy = HEIGHT / 2;


//始点、終点からベクトル（配列）を返す
function vec(start_vertex, end_vertex){
    let s = start_vertex;
    let e = end_vertex;
    let vec = [e.x - s.x, e.y - s.y, e.z - s.z];
    return vec;
}

//ベクトルの正規化
function norm(vec){
    let l = len(vec);
    for(let i = 0; i < vec.length; i++){
        vec[i] = vec[i] / l;
    }
    return vec;
}
//ベクトルの長さ（絶対値）
function len(vec){
    return Math.sqrt(vec[0] ** 2 + vec[1] ** 2 + vec[2] ** 2);
}

//ベクトルの内積
function inner(vec1, vec2){
    let rtn = 0;
    for(let i = 0; i < 3; i++){
        rtn += (vec1[i] * vec2[i]);
    }
    return rtn;
}

//ベクトルの外積
function cross(vec1, vec2){
    let rtn = [];
    for(let i = 0; i < 3; i++){
        let a = (i + 1) % 3;
        let b = (i + 2) % 3;
        rtn.push(vec1[a] * vec2[b] - vec1[b] * vec2[a]);
    }
    return rtn;
}

//内積からcosの値を返す
function rtnCos(vec1, vec2){
    let l1 = len(vec1);
    let l2 = len(vec2);
    let inr = inner(vec1, vec2);
    return inr / (l1 * l2);
}

//弧度法に変換
function rad(angle){
    return angle * Math.PI / 180;
}

//ベクトルの回転
function rotate([psi, theta, phi], vec){
    //vecは回転の中心から見たベクトル
    let rtn = [0, 0, 0];
    //回転行列(z軸周りにpsi、y軸周りにtheta、x軸周りにphi回転)
    let R = [
        [c(psi) * c(theta), c(psi) * s(theta) * s(phi) - c(phi) * s(psi), s(psi) * s(phi) + c(psi) * c(phi) * s(theta)],
        [c(theta) * s(psi), c(psi) * c(phi) + s(psi) * s(theta) * s(phi), c(phi) * s(psi) * s(theta) - c(psi) * s(phi)],
        [-s(theta), c(theta) * s(phi), c(theta) * c(phi)]
    ]
    function c(rad){
        return Math.cos(rad);            
    }
    function s(rad){
        return Math.sin(rad);
    }
    //Rとvecの積を計算
    for(let i = 0; i < 3; i++){
        for(let j = 0; j < 3; j++){
            rtn[i] += ( vec[j] * R[i][j] );
        }
    }
    return rtn;
}


window.addEventListener("keypress", keypress)
function keypress(e){
    switch(e.key){
        case "1" :
            objs.forEach((e)=>{
                e.spin(rad(1), 0, 0);
            });
            break;
        case "2" :
            objs.forEach((e)=>{
                e.spin(0, rad(1), 0);
            });
            break;
        case "3" :
            objs.forEach((e)=>{
                e.spin(0, 0, rad(1));
            });
            break;
        case "4":
            cam.spin(rad(1), 0, 0);
            break;
        case "5":
            cam.spin(0, rad(1), 0);
            break;
        case "6":
            cam.spin(0, 0, rad(1));
            break;
        case "s":
            objs.forEach((e)=>{
                e.move(1, 0, 0);
            });
            break;
        case "d":
            objs.forEach((e)=>{
                e.move(0, 1, 0);
            });
            break;
        case "f":
            objs.forEach((e)=>{
                e.move(0, 0, 1);
            });
            break;
        case "j":
            cam.move(-1,0,0);
            break;
        case "k":
            cam.move(0,-1,0);
            break;
        case "l":
            cam.move(0,0,-1);
            break;
}
}
function main(){
    cam.render(objs, ctxt, dx, dy);
    requestAnimationFrame(main);
}
main();